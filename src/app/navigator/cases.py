"""Company requests ("cases"): understand -> match -> technical review -> invite to Bern.

Stored locally in SQLite (data/cases.db): one JSON document per case plus its activity log.
Nothing is sent anywhere by the server: emails open in the officer's own mail client (mailto)
and calls are offered as a calendar file (.ics).
"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

import yaml

from . import index, plain, search, showcase
from .config import CONFIG_DIR, DATA_DIR

DB = DATA_DIR / "cases.db"
_lock = threading.Lock()

Status = Literal["new", "in_review", "changes_requested", "approved", "contacted", "call_scheduled", "closed"]
Role = Literal["officer", "reviewer"]


class Match(BaseModel):
    id: str
    name: str
    entity_type: str
    role: str | None = None
    unit: str | None = None
    institution: str = ""
    why: str = ""
    plain: str | None = None           # first descriptive sentence, for non-specialists
    url: str = ""
    contact: str | None = None
    confidence: float = 0.0
    via: str | None = None
    selected: bool = False
    review: Literal["ok", "no"] | None = None
    review_note: str = ""


class Event(BaseModel):
    at: str
    actor: str
    role: str = ""
    kind: str
    text: str = ""


class Case(BaseModel):
    id: str
    created_at: str
    updated_at: str
    status: Status = "new"
    company: str = ""                # may be filled in later (needed before pitching)
    contact_name: str = ""
    contact_email: str = ""
    country: str = ""
    canton: str = ""                 # when the company is in Switzerland
    area: str = ""                   # medtech area id   (config/medtech_areas.yaml)
    niche: str = ""                  # niche id within the area
    request_text: str
    analysis: plain.RequestAnalysis
    matches: list[Match] = []
    no_match_message: str | None = None
    reviewer: str = ""
    review_note: str = ""          # officer -> reviewer
    review_comment: str = ""       # reviewer -> officer
    outreach: dict = Field(default_factory=dict)
    events: list[Event] = []


class NewCase(BaseModel):
    """Search-first: what the company is looking for + optional filters. Contact details come later."""
    request_text: str = Field(..., min_length=3, max_length=12000)
    company: str = Field("", max_length=200)
    contact_name: str = Field("", max_length=200)
    contact_email: str = Field("", max_length=200)
    country: str = Field("", max_length=100)
    canton: str = Field("", max_length=60)
    area: str = Field("", max_length=40)
    niche: str = Field("", max_length=40)
    lang: str = "en"
    actor: str = Field(..., min_length=1, max_length=120)
    role: Role


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _conn() -> sqlite3.Connection:
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB)
    c.execute("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, updated_at TEXT, data TEXT NOT NULL)")
    return c


def save(case: Case) -> Case:
    case.updated_at = _now()
    with _lock, _conn() as c:
        c.execute("INSERT OR REPLACE INTO cases VALUES (?, ?, ?)", (case.id, case.updated_at, case.model_dump_json()))
    return case


def get(cid: str) -> Case | None:
    with _conn() as c:
        row = c.execute("SELECT data FROM cases WHERE id = ?", (cid,)).fetchone()
    return Case.model_validate_json(row[0]) if row else None


def list_cases() -> list[Case]:
    with _conn() as c:
        rows = c.execute("SELECT data FROM cases ORDER BY updated_at DESC").fetchall()
    return [Case.model_validate_json(r[0]) for r in rows]


def delete(cid: str) -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM cases WHERE id = ?", (cid,))


def log(case: Case, actor: str, kind: str, text: str = "", role: str = "") -> None:
    case.events.append(Event(at=_now(), actor=actor or "—", role=role, kind=kind, text=text))


# ---------------- matching ---------------------------------------------------
_ORDER = {"person": 0, "unit": 1, "infrastructure": 2, "project": 3}


def medtech_areas() -> list[dict]:
    p = CONFIG_DIR / "medtech_areas.yaml"
    return (yaml.safe_load(p.read_text()) or {}).get("areas", []) if p.exists() else []


def niche_query(area: str, niche: str) -> str:
    """Search terms for the chosen medtech niche (or, with only an area, one key term per niche)."""
    for a in medtech_areas():
        if a["id"] == area:
            if niche:
                return next((n["query"] for n in a.get("niches", []) if n["id"] == niche), "")
            return " ".join(n["query"].split()[0] for n in a.get("niches", []))
    return ""


def find_matches(analysis: plain.RequestAnalysis, k: int = 12) -> tuple[list[Match], str | None]:
    """People, labs and facilities first (someone to contact), projects after (context)."""
    ents = index.load_entities()
    r = search.search(analysis.search_query, k=k + 6)
    if r.abstained:
        return [], r.message
    out = []
    for x in r.results:
        e = ents.get(x.id)
        out.append(Match(
            id=x.id, name=x.person_or_unit, entity_type=x.entity_type, role=x.role, unit=x.affiliation.unit,
            institution=x.institution, why=x.why_match, url=(x.sources[0].url if x.sources else ""),
            plain=(e.description[0] if e and e.description else None), contact=x.contact,
            confidence=x.confidence, via=x.via))
    # People first (someone to contact), and among people the leads first: a company should meet the
    # professor or group head, not an intern. Stable sort keeps relevance order within each band.
    def rank(m: Match) -> tuple:
        e = ents.get(m.id)
        sen = search.seniority(e) if e and m.entity_type == "person" else 1.0
        band = 0 if sen >= 1.2 else 1 if sen >= 0.8 else 2
        return (_ORDER.get(m.entity_type, 9), band if m.entity_type == "person" else 0)
    out.sort(key=rank)
    return out[:k], None


def create(req: NewCase) -> Case:
    analysis = plain.analyze_request(req.request_text, req.lang)
    # the chosen medtech niche sharpens the search; the company's own words stay in the query
    extra = niche_query(req.area, req.niche)
    if extra:
        analysis.search_query = f"{extra} {analysis.search_query}".strip()
    matches, msg = find_matches(analysis)
    now = _now()
    swiss = req.country.strip().lower() in ("switzerland", "schweiz", "suisse", "svizzera", "ch")
    case = Case(id=uuid.uuid4().hex[:10], created_at=now, updated_at=now, company=req.company.strip(),
                contact_name=req.contact_name.strip(), contact_email=req.contact_email.strip(),
                country=req.country.strip(), canton=req.canton.strip() if swiss else "", area=req.area, niche=req.niche,
                request_text=req.request_text.strip(), analysis=analysis, matches=matches, no_match_message=msg)
    log(case, req.actor, "created", f"Request received{' from ' + case.company if case.company else ''}", "officer")
    log(case, "Navigator", "analysed",
        f"Plain-language summary by {'Apertus' if analysis.generated_by == 'apertus' else 'glossary rules'}; "
        f"{len(matches)} possible partners found in Bern")
    return save(case)


def rematch(case: Case, query: str, actor: str, role: str = "officer") -> Case:
    keep = {m.id: m for m in case.matches if m.selected}
    case.analysis.search_query = query
    found, msg = find_matches(case.analysis)
    case.matches = list(keep.values()) + [m for m in found if m.id not in keep]
    case.no_match_message = msg if not case.matches else None
    log(case, actor, "rematched", f"Searched again for: {query}", role)
    return save(case)


# ---------------- outreach ---------------------------------------------------
_T = {
    "en": {
        "subject": "Research partners in Bern for {company}",
        "hello": "Dear {name},",
        "intro": "Thank you for your interest in the Canton of Bern. Based on your request{need}, we have identified "
                 "the following research partners here in Bern:",
        "brief": "We have put together a short overview for you — every statement in it is linked to its public source:",
        "why": "Why Bern",
        "call": "We would be glad to introduce you personally and to set up a short call with the experts. "
                "Would one of these times suit you?",
        "nocall": "We would be glad to introduce you personally. Just reply to this email and we will arrange the next steps.",
        "bye": "Kind regards,",
        "src": "source",
    },
    "de": {
        "subject": "Forschungspartner in Bern für {company}",
        "hello": "Guten Tag {name}",
        "intro": "Vielen Dank für Ihr Interesse am Kanton Bern. Aufgrund Ihrer Anfrage{need} haben wir folgende "
                 "Forschungspartner in Bern gefunden:",
        "brief": "Wir haben für Sie eine kurze Übersicht zusammengestellt — jede Aussage darin ist mit ihrer öffentlichen Quelle verlinkt:",
        "why": "Warum Bern",
        "call": "Gerne stellen wir Sie persönlich vor und organisieren ein kurzes Gespräch mit den Fachleuten. "
                "Passt Ihnen einer dieser Termine?",
        "nocall": "Gerne stellen wir Sie persönlich vor. Antworten Sie einfach auf diese E-Mail, wir organisieren die nächsten Schritte.",
        "bye": "Freundliche Grüsse",
        "src": "Quelle",
    },
    "fr": {
        "subject": "Partenaires de recherche à Berne pour {company}",
        "hello": "Bonjour {name},",
        "intro": "Merci de votre intérêt pour le canton de Berne. Suite à votre demande{need}, nous avons identifié "
                 "les partenaires de recherche suivants à Berne :",
        "brief": "Nous avons préparé pour vous un bref aperçu — chaque affirmation y est liée à sa source publique :",
        "why": "Pourquoi Berne",
        "call": "Nous serions heureux de vous présenter personnellement et d'organiser un bref appel avec les experts. "
                "L'un de ces créneaux vous conviendrait-il ?",
        "nocall": "Nous serions heureux de vous présenter personnellement. Répondez simplement à cet e-mail et nous organiserons la suite.",
        "bye": "Meilleures salutations,",
        "src": "source",
    },
}


def draft_email(case: Case, lang: str, slots: list[str], sender: str, team: str, link: str = "") -> dict:
    """Deterministic template: only approved matches and verified proof points, each with its link.
    With a published executive brief the email stays short and points to it."""
    t = _T.get(lang, _T["en"])
    if link:
        approved = [m for m in case.matches if m.selected and m.review == "ok"]
        lines = [t["hello"].format(name=case.contact_name or case.company), "", t["intro"].format(need=""), ""]
        lines += [f"• {m.name}{' – ' + m.unit if m.unit else ''} ({m.institution})" for m in approved]
        lines += ["", t["brief"], link, "", t["call"] if slots else t["nocall"]]
        lines += [f"  – {s}" for s in slots]
        lines += ["", t["bye"], sender or "", team or ""]
        return {"subject": t["subject"].format(company=case.company), "body": "\n".join(lines).strip() + "\n",
                "to": case.contact_email, "matches": [m.id for m in approved]}
    approved = [m for m in case.matches if m.selected and m.review == "ok"] or [m for m in case.matches if m.selected]
    lines = [t["hello"].format(name=case.contact_name or case.company), "", t["intro"].format(need=""), ""]
    for m in approved:
        who = ", ".join(x for x in [m.role, m.unit] if x)
        lines.append(f"• {m.name}{' – ' + who if who else ''} ({m.institution})")
        if m.plain:
            lines.append(f"  {m.plain}")
        lines.append(f"  {m.url}")
    hl = showcase.build().get("highlights", [])[:2]
    if hl:
        lines += ["", f"{t['why']}:"]
        for h in hl:
            lines.append(f"• “{h['quote'].strip()}” ({t['src']}: {h['url']})")
    lines += ["", t["call"] if slots else t["nocall"]]
    lines += [f"  – {s}" for s in slots]
    lines += ["", t["bye"], sender or "", team or ""]
    return {"subject": t["subject"].format(company=case.company), "body": "\n".join(lines).strip() + "\n",
            "to": case.contact_email, "matches": [m.id for m in approved]}


def ics(case: Case, start_iso: str, minutes: int, organizer: str, organizer_email: str) -> str:
    start = datetime.fromisoformat(start_iso)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone(timedelta(hours=2)))  # assume Swiss local time if not given
    start = start.astimezone(timezone.utc)
    end = start + timedelta(minutes=minutes)
    fmt = "%Y%m%dT%H%M%SZ"
    experts = ", ".join(m.name for m in case.matches if m.selected and m.review != "no")
    desc = (f"Introduction call: {case.company} and research partners in Bern ({experts}). "
            f"Prepared with the Bern Expertise Navigator.").replace("\n", " ")
    attendees = [a for a in [case.contact_email, organizer_email] if a]
    return "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bern Expertise Navigator//EN", "METHOD:REQUEST", "BEGIN:VEVENT",
        f"UID:{case.id}-{start.strftime(fmt)}@expertise-navigator", f"DTSTAMP:{datetime.now(timezone.utc).strftime(fmt)}",
        f"DTSTART:{start.strftime(fmt)}", f"DTEND:{end.strftime(fmt)}",
        f"SUMMARY:{case.company} × Bern research partners",
        f"DESCRIPTION:{desc}",
        *(f"ORGANIZER;CN={organizer}:mailto:{organizer_email}" for _ in [0] if organizer_email),
        *(f"ATTENDEE;RSVP=TRUE:mailto:{a}" for a in attendees),
        "END:VEVENT", "END:VCALENDAR", ""])
