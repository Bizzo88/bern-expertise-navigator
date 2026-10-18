"""Stage 3 — structured extraction with Apertus + snippet verification.

Anti-hallucination contract:
  * the model must quote a verbatim snippet for every value;
  * we verify that the snippet really occurs in the page text and that the value is supported by it;
  * anything that fails is dropped and logged (data/rejected.jsonl) — shown in the pitch as rigour.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata

from . import llm
from .config import DATA_DIR, settings
from .schema import Cited, Entity, Evidence, Extraction, ExtractedEntity, Page

SYSTEM = """You extract structured facts about research expertise from ONE public web page.
Rules (strict):
- Use ONLY information written on the page. Never use outside knowledge. Never guess.
- For every value, copy a short VERBATIM snippet (one sentence or line) from the page that contains it.
- If a field is not on the page, omit it. Empty is better than invented.
- Keep the page's language for values (German, French or English).
- expertise = research topics, methods, technologies, clinical or scientific fields (short noun phrases).
- infrastructure = labs, equipment, facilities, platforms or services offered.
- unit = the research group / lab; institute = the institute, centre, department or clinic.
- email only if it is written on the page.
- description = up to 2 sentences copied from the page that describe the entity's research or offer.
- Do not create entities for navigation items, news headlines, funders or generic words.
Return JSON only."""

USER_TMPL = """PAGE TYPE (hint): {ptype}
URL: {url}
TITLE: {title}

PAGE TEXT:
<<<
{text}
>>>

Extract the entities described on this page. A person profile usually has 1 person; a group or team
page has 1 unit and may list several people with their roles (one entity per listed person); a
facility or service page has 1 infrastructure entity; a project page has 1 project entity."""

MAX_CHARS = 12000
PROMPT_VERSION = "v3"  # bump when SYSTEM/USER_TMPL change -> invalidates the extraction cache
CACHE_DIR = DATA_DIR / "cache" / "extract"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower()
    s = re.sub(r"[‐-―]", "-", s)
    s = re.sub(r"[‘’‚‛`´]", "'", s)
    s = re.sub(r"[“”„‟«»]", '"', s)
    s = re.sub(r"(^|\n)\s*[-*•·|]\s*", " ", s)  # list bullets / table pipes
    s = s.replace("|", " ")
    return re.sub(r"\s+", " ", s).strip()


_TITLES = r"\b(prof|professor|dr|med|phil|nat|rer|dent|vet|pd|msc|bsc|phd|dipl|ing|eth|em|associate|assistant|ass|assoc)\b\.?"


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def name_key(name: str) -> str:
    """Identity key for merging: 'Prof. Dr. med. José García' == 'Jose Garcia'."""
    s = re.sub(_TITLES, " ", strip_accents(_norm(name)))
    return re.sub(r"[^\w]+", " ", s).strip()


def unit_key(name: str) -> str:
    """Looser key for labs/units: 'Gerontechnology & Rehabilitation' == 'Gerontechnology and Rehabilitation',
    'AI in Medical Imaging Laboratory' == 'AI in Medical Imaging'."""
    toks = name_key(name.replace("&", " ")).split()
    drop = {"and", "und", "et", "lab", "labor", "laboratory", "laboratories", "group", "team", "the"}
    # light plural folding: the same lab is spelled "Robotic" and "Robotics" on one site
    return " ".join(t[:-1] if len(t) > 4 and t.endswith("s") else t for t in toks if t not in drop)


def supported(c: Cited | None, page_norm: str) -> bool:
    """Snippet must be in the page; value must be in the snippet (loose token check)."""
    if c is None or not c.value.strip() or not c.snippet.strip():
        return False
    snip = _norm(c.snippet).strip(" .…")
    if len(snip) < 3 or snip not in page_norm:
        return False
    tokens = [t for t in re.findall(r"\w+", _norm(c.value)) if len(t) > 2]
    return not tokens or sum(t in snip for t in tokens) / len(tokens) >= 0.6


def verify(ent: ExtractedEntity, page: Page, rejected: list[dict]) -> ExtractedEntity | None:
    pn = _norm(page.text + " " + page.title)
    first_line = next((l for l in page.text.splitlines() if l.strip()), "")
    heading = _norm(page.title + " " + first_line)

    def keep(field: str, c: Cited | None) -> Cited | None:
        if c is None:
            return None
        if supported(c, pn):
            return c
        # Relations: "X is listed on the page about Y" -> Y (unit/project) supported when Y is the
        # page's own heading and X's verbatim line is on that page.
        if field in ("unit", "institute", "projects") and c.value.strip() and _norm(c.value) in heading \
                and len(_norm(c.snippet)) >= 3 and _norm(c.snippet) in pn:
            return c
        rejected.append({"source": page.source, "url": page.url, "field": field,
                         "value": c.value, "snippet": c.snippet})
        return None

    if keep("name", ent.name) is None:
        return None  # no verifiable name -> no entity
    return ExtractedEntity(
        entity_type=ent.entity_type, name=ent.name,
        role=keep("role", ent.role), unit=keep("unit", ent.unit), institute=keep("institute", ent.institute),
        email=keep("email", ent.email),
        expertise=[c for c in ent.expertise if keep("expertise", c)],
        projects=[c for c in ent.projects if keep("projects", c)],
        infrastructure=[c for c in ent.infrastructure if keep("infrastructure", c)],
        description=[c for c in ent.description if keep("description", c)],
    )


def _raw_extract(page: Page) -> Extraction:
    """One Apertus call per page, cached on (model, prompt version, page content)."""
    key = hashlib.sha1(f"{settings.llm_model}|{PROMPT_VERSION}|{page.page_type}|{page.url}|{page.text}".encode()).hexdigest()
    cp = CACHE_DIR / f"{key}.json"
    if cp.exists():
        return Extraction.model_validate_json(cp.read_text())
    msg = USER_TMPL.format(ptype=page.page_type or "unknown", url=page.url, title=page.title,
                           text=page.text[:MAX_CHARS])
    out: Extraction = llm.chat_json(  # type: ignore[assignment]
        [{"role": "system", "content": SYSTEM}, {"role": "user", "content": msg}],
        Extraction, max_tokens=3000)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cp.write_text(out.model_dump_json())
    return out


def extract_page(page: Page, rejected: list[dict], extractor: str = "apertus") -> list[ExtractedEntity]:
    if extractor == "rules":
        from . import rules_extract
        out = Extraction.model_validate({"entities": rules_extract.extract_page(page)})
    else:
        out = _raw_extract(page)
    return [v for e in out.entities if (v := verify(e, page, rejected))]


def to_entity(e: ExtractedEntity, page: Page, source_label: str, extractor: str = "apertus") -> Entity:
    ev = [Evidence(field="name", value=e.name.value, snippet=e.name.snippet, url=page.url)]
    for f in ("role", "unit", "institute", "email"):
        c = getattr(e, f)
        if c:
            ev.append(Evidence(field=f, value=c.value, snippet=c.snippet, url=page.url))
    for f in ("expertise", "projects", "infrastructure", "description"):
        ev += [Evidence(field=f, value=c.value, snippet=c.snippet, url=page.url) for c in getattr(e, f)]
    key = f"{e.entity_type}:{name_key(e.name.value)}:{page.source}"
    return Entity(
        id=hashlib.sha1(key.encode()).hexdigest()[:16], entity_type=e.entity_type, name=e.name.value,
        role=e.role.value if e.role else None, unit=e.unit.value if e.unit else None,
        institute=e.institute.value if e.institute else None, email=e.email.value if e.email else None,
        expertise=[c.value for c in e.expertise], projects=[c.value for c in e.projects],
        infrastructure=[c.value for c in e.infrastructure],
        description=[c.snippet for c in e.description],
        source=page.source, source_label=source_label, source_urls=[page.url],
        evidence=ev, retrieved_at=page.fetched_at, extractor=extractor,
    )


def merge(entities: list[Entity]) -> list[Entity]:
    """Same person/unit seen on several pages of one source -> one entity with all evidence."""
    by_id: dict[str, Entity] = {}
    for e in entities:
        if e.id not in by_id:
            by_id[e.id] = e
            continue
        m = by_id[e.id]
        m.role = m.role or e.role
        m.unit = m.unit or e.unit
        m.institute = m.institute or e.institute
        m.email = m.email or e.email
        for f in ("expertise", "projects", "infrastructure", "description"):
            setattr(m, f, list(dict.fromkeys(getattr(m, f) + getattr(e, f))))
        # A profile page (more evidence) is a better canonical source than a directory listing
        if len(e.evidence) > len(m.evidence) and e.source_urls[0] not in m.source_urls:
            m.source_urls = e.source_urls + m.source_urls
        m.source_urls = list(dict.fromkeys(m.source_urls + e.source_urls))
        m.evidence += e.evidence
    return list(by_id.values())


def _dir(url: str) -> str:
    return re.sub(r"/(index_\w+\.html?|index\.html?)?$", "/", url.split("#")[0].split("?")[0])


def link_site_structure(entities: list[Entity]) -> list[Entity]:
    """Use the site hierarchy as evidence of belonging.

    A page under /research/aihn/... belongs to the unit whose page is /research/aihn/. Persons without
    a unit get it; "units" nested under another unit are really its projects. The added evidence is the
    unit page's own heading, cited with that page's URL, so it stays verifiable.
    """
    units = [(_dir(u.source_urls[0]), u) for u in entities if u.entity_type == "unit" and u.source_urls]
    units.sort(key=lambda x: -len(x[0]))

    def parent(e: Entity) -> Entity | None:
        for url in e.source_urls:
            d = _dir(url)
            for ud, u in units:
                if u.id != e.id and u.source == e.source and d.startswith(ud) and d != ud \
                        and ud.count("/") > 3:  # never the site root / top-level section
                    return u
        return None

    for e in entities:
        p = parent(e)
        if not p:
            continue
        name_ev = next((ev for ev in p.evidence if ev.field == "name"), None)
        if not name_ev:
            continue
        if e.entity_type == "unit":
            e.entity_type = "project"  # a "unit" page nested in a unit is one of its research lines
        if not e.unit and e.entity_type in ("person", "project", "infrastructure"):
            e.unit = p.name
            e.evidence.append(Evidence(field="unit", value=p.name, snippet=name_ev.snippet, url=name_ev.url))
        if e.entity_type == "project" and e.name not in p.projects:
            p.projects.append(e.name)
            p.evidence.append(Evidence(field="projects", value=e.name,
                                       snippet=next(ev.snippet for ev in e.evidence if ev.field == "name"),
                                       url=e.source_urls[0]))
    return entities


_NOT_A_LAB = re.compile(r"\b(team|members|staff|people|universit\w*|hospital|spital|inselspital|safety)\b|/", re.I)


def derive_units(entities: list[Entity], min_people: int = 2) -> list[Entity]:
    """Labs that only appear as headings on a team page ("PrecisionLab", 7 people listed under it)
    become unit entities, so they can be browsed, searched and linked. Their evidence is the
    people's own verified 'unit' citation (the heading on the team page)."""
    have = {(e.source, unit_key(e.name)) for e in entities if e.entity_type != "person"}
    # an institution/centre is not a lab: "ARTORG Center for Biomedical Engineering Research"
    have |= {(e.source, unit_key(x)) for e in entities for x in (e.institute, e.source_label) if x}
    groups: dict[tuple[str, str], list[Entity]] = {}
    for e in entities:
        if e.entity_type == "person" and e.unit and not _NOT_A_LAB.search(e.unit.strip()):
            groups.setdefault((e.source, unit_key(e.unit)), []).append(e)
    out = list(entities)
    for (source, key), people in groups.items():
        if (source, key) in have or len(people) < min_people:
            continue
        ev = next((ev for p in people for ev in p.evidence if ev.field == "unit"), None)
        if ev is None:
            continue
        name = people[0].unit
        out.append(Entity(
            id=hashlib.sha1(f"unit:{key}:{source}".encode()).hexdigest()[:16], entity_type="unit", name=name,
            source=source, source_label=people[0].source_label, source_urls=[ev.url],
            evidence=[Evidence(field="name", value=name, snippet=ev.snippet, url=ev.url)],
            retrieved_at=people[0].retrieved_at, extractor=people[0].extractor))
    return out


def write_rejected(rejected: list[dict], source: str | None = None) -> None:
    """Rewrite the log for the (re)processed source(s); keep other sources' entries."""
    p = DATA_DIR / "rejected.jsonl"
    keep: list[str] = []
    if source and p.exists():
        keep = [l for l in p.open() if l.strip() and json.loads(l).get("source") != source]
    with p.open("w") as fh:
        fh.writelines(keep)
        for r in rejected:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
