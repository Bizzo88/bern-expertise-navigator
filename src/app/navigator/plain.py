"""Plain language for non-specialists: jargon explanations and company-request summaries.

* Glossary (config/plain_glossary.yaml): reviewed, deterministic, EN/DE.
* Apertus (when reachable): summarises a company request in plain words and explains terms the
  glossary does not cover. It only sees the request text; every AI-written item is labelled.
"""
from __future__ import annotations

import re
from functools import lru_cache

import yaml
from pydantic import BaseModel, Field

from . import llm
from .config import CONFIG_DIR

GLOSSARY = CONFIG_DIR / "plain_glossary.yaml"


@lru_cache(maxsize=2)
def _glossary(_mt: float) -> list[dict]:
    if not GLOSSARY.exists():
        return []
    out = []
    for t in (yaml.safe_load(GLOSSARY.read_text()) or {}).get("terms", []):
        forms = sorted({t["term"].lower(), *(a.lower() for a in t.get("aka", []))}, key=len, reverse=True)
        out.append({**t, "forms": forms})
    return out


def glossary() -> list[dict]:
    return _glossary(GLOSSARY.stat().st_mtime if GLOSSARY.exists() else 0.0)


def find_terms(text: str, lang: str = "en") -> list[dict]:
    """Glossary terms occurring in `text`, with the exact form found and its plain explanation."""
    low = text.lower()
    found = []
    for t in glossary():
        for f in t["forms"]:
            if re.search(rf"(?<![\w-]){re.escape(f)}(?![\w-])", low):
                found.append({"term": t["term"], "found_as": f, "plain": t.get(lang) or t["en"], "source": "glossary"})
                break
    return found


class RequestAnalysis(BaseModel):
    summary: str = Field(description="2-3 short sentences in plain language: who the company is and what they want")
    company_does: str = Field("", description="One plain sentence: what the company makes or does")
    company_needs: list[str] = Field([], description="What they are looking for in Bern, as short plain phrases")
    sector: str = Field("", description="e.g. medtech / diabetes technology")
    search_query: str = Field("", description="Short technical search query to find matching researchers")
    terms: list[dict] = Field([], description="[{term, plain}] technical words in the request explained simply")
    generated_by: str = "rules"


class _LLMAnalysis(BaseModel):
    summary: str
    company_does: str
    company_needs: list[str]
    sector: str
    search_query: str
    terms: list[dict[str, str]]


_NEED = re.compile(r"\b(looking for|look for|seek|seeking|need|needs|want|wish|interested in|would like|plan to|"
                   r"partner|collaborat|access to|find|suchen|benötigen|interessiert|cherchons|besoin)\b", re.I)
_SENT = re.compile(r"(?<=[.!?])\s+")


def _rules_analysis(text: str, lang: str) -> RequestAnalysis:
    sents = [s.strip() for s in _SENT.split(" ".join(text.split())) if len(s.strip()) > 15]
    needs = [s for s in sents if _NEED.search(s)][:4]
    does = next((s for s in sents if s not in needs), sents[0] if sents else "")
    terms = find_terms(text, lang)
    query = " ".join(dict.fromkeys(t["term"] for t in terms)) or " ".join(needs)[:200] or text[:200]
    summary = " ".join(sents[:2])
    return RequestAnalysis(summary=summary, company_does=does, company_needs=needs, sector="",
                           search_query=query, terms=terms, generated_by="rules")


def analyze_request(text: str, lang: str = "en") -> RequestAnalysis:
    base = _rules_analysis(text, lang)
    if not llm.available():
        return base
    language = {"de": "German", "fr": "French"}.get(lang, "English")
    try:
        r: _LLMAnalysis = llm.chat_json([  # type: ignore[assignment]
            {"role": "system", "content": (
                "You help an economic-development officer who is NOT a technical expert understand company "
                "requests. Use ONLY the request text. Do not invent facts about the company. Plain, friendly "
                f"language a 15-year-old understands. Write in {language}. JSON only.")},
            {"role": "user", "content": (
                "Company request:\n<<<\n" + text[:6000] + "\n>>>\n\n"
                "Return: summary (2-3 plain sentences), company_does (1 sentence), company_needs (short phrases), "
                "sector, search_query (5-10 technical keywords to find matching university researchers), "
                "terms (every technical word or abbreviation in the request, each with a one-sentence plain explanation).")},
        ], _LLMAnalysis, max_tokens=900)
    except llm.LLMError:
        return base
    known = {t["term"] for t in base.terms} | {t["found_as"] for t in base.terms}
    ai_terms = [{"term": t.get("term", ""), "found_as": t.get("term", "").lower(), "plain": t.get("plain", ""),
                 "source": "apertus"} for t in r.terms
                if t.get("term") and t.get("plain") and t["term"].lower() not in known]
    return RequestAnalysis(summary=r.summary, company_does=r.company_does, company_needs=r.company_needs,
                           sector=r.sector, search_query=r.search_query or base.search_query,
                           terms=base.terms + ai_terms, generated_by="apertus")


def analyze_company(name: str, description: str, text: str, need: str = "", lang: str = "en") -> RequestAnalysis:
    """The company in plain words, from its website and/or what the officer pasted, plus the optional
    "what are they looking for". The search query leads with the stated need: that is what Bern answers."""
    base = _rules_analysis(" ".join(x for x in [description, text] if x), lang)
    # whole sentences only, line by line, so headings and menu items never run into a sentence
    sents = [x.strip() for line in text.splitlines() for x in _SENT.split(" ".join(line.split()))
             if 40 <= len(x.strip()) <= 400 and x.strip()[-1:] in ".!?" and not x.strip()[0].islower()]
    does = description or base.company_does or (sents[0] if sents else "")
    lead = f"{name}: {does}" if name and does and name.lower() not in does.lower() else does
    summary = lead
    for x in sents:
        if len(summary) + len(x) > 600:
            break
        if x != does and x not in summary:
            summary = f"{summary} {x}".strip()
    needs = [need.strip()] if need.strip() else []
    terms = find_terms(" ".join([need, description, text]), lang)
    query = " ".join(dict.fromkeys([need.strip(), *(t["term"] for t in terms[:8])])).strip() \
        or (description or text)[:200]
    base = RequestAnalysis(summary=summary, company_does=does, company_needs=needs, sector="",
                           search_query=query[:300], terms=terms, generated_by="rules")
    if not llm.available():
        return base
    language = {"de": "German", "fr": "French"}.get(lang, "English")
    try:
        r: _LLMAnalysis = llm.chat_json([  # type: ignore[assignment]
            {"role": "system", "content": (
                "You help an economic-development officer of the Canton of Bern who is NOT a technical expert "
                "understand a company. Use ONLY the text given. Do not invent facts about the company. Plain, "
                f"friendly language a 15-year-old understands. Write in {language}. JSON only.")},
            {"role": "user", "content": (
                f"Company: {name or 'unknown'}\n"
                + (f"What the officer says they are looking for: {need}\n" if need else "")
                + "Text from the company's website or the officer's notes:\n<<<\n" + text[:6000] + "\n>>>\n\n"
                "Return: summary (2-3 plain sentences: who they are and what they make), company_does (1 sentence), "
                "company_needs (what they are looking for if stated; otherwise the kinds of research partners, "
                "clinics or test facilities that could help them, as short phrases), sector, "
                "search_query (5-10 technical keywords to find matching university researchers, labs and facilities), "
                "terms (technical words or abbreviations in the text, each with a one-sentence plain explanation).")},
        ], _LLMAnalysis, max_tokens=900)
    except llm.LLMError:
        return base
    known = {t["term"] for t in base.terms} | {t["found_as"] for t in base.terms}
    ai_terms = [{"term": t.get("term", ""), "found_as": t.get("term", "").lower(), "plain": t.get("plain", ""),
                 "source": "apertus"} for t in r.terms
                if t.get("term") and t.get("plain") and t["term"].lower() not in known]
    query = " ".join(x for x in [need.strip(), r.search_query] if x) or base.search_query
    return RequestAnalysis(summary=r.summary, company_does=r.company_does,
                           company_needs=needs + [n for n in r.company_needs if n not in needs], sector=r.sector,
                           search_query=query[:300], terms=base.terms + ai_terms, generated_by="apertus")
