"""Stage 2 — page type: cheap URL rules first, Apertus only for ambiguous pages."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from . import llm
from .config import Source
from .schema import Page, PageType

GENERIC = {
    "person": ["/people/", "/personen/", "/team/", "/staff/", "/mitarbeitende/", "/profile/", "/group_members/"],
    "project": ["/project", "/projekt"],
    "infrastructure": ["/facilit", "/infrastru", "/services", "/dienstleistung", "/core-facility", "/platform"],
    "unit": ["/research/", "/forschung/", "/group", "/gruppe", "/lab", "/institut", "/department", "/abteilung"],
}


class _PageTypeOut(BaseModel):
    page_type: Literal["person", "unit", "project", "infrastructure", "other"]


def rule_type(page: Page, src: Source | None) -> PageType | None:
    url = page.url.lower()
    rules = dict(GENERIC)
    if src:
        for k, v in src.page_types.items():
            rules[k] = list(v) + rules.get(k, [])
    for t in ["person", "project", "infrastructure", "unit"]:  # most specific first
        if any(p.lower() in url for p in rules.get(t, [])):
            return t  # type: ignore[return-value]
    return None


def classify(page: Page, src: Source | None, use_llm: bool = True) -> PageType:
    t = rule_type(page, src)
    if t or not use_llm:
        return t or "other"
    try:
        out = llm.chat_json([
            {"role": "system", "content": "Classify a university web page. Answer with JSON only."},
            {"role": "user", "content": (
                "Types: person (an individual's profile), unit (research group/institute/department), "
                "project, infrastructure (facility, service, platform), other (news, events, admin).\n"
                f"TITLE: {page.title}\nURL: {page.url}\nTEXT:\n{page.text[:2500]}")},
        ], _PageTypeOut, max_tokens=50)
        return out.page_type  # type: ignore[attr-defined]
    except llm.LLMError:
        return "other"
