"""Search behaviour without GPU / LLM / model download: a tiny hashing embedder stands in for e5."""
import hashlib
import re
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from navigator import config, index, search  # noqa: E402
from navigator.schema import Entity, Evidence  # noqa: E402

URL = "https://www.example.unibe.ch/"


def fake_embed(texts, query=False):
    out = np.zeros((len(texts), 4096), dtype=np.float32)
    for i, t in enumerate(texts):
        for tok in re.findall(r"\w{3,}", t.lower()):
            out[i, int(hashlib.md5(tok.encode()).hexdigest(), 16) % 4096] += 1
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)


def ent(i, name, etype, unit, expertise, source="artorg"):
    ev = [Evidence(field="name", value=name, snippet=f"{name} works here.", url=URL + str(i))]
    ev += [Evidence(field="expertise", value=x, snippet=f"{name} researches {x}.", url=URL + str(i)) for x in expertise]
    return Entity(id=f"e{i}", entity_type=etype, name=name, unit=unit, expertise=expertise, source=source,
                  source_label=source.upper(), source_urls=[URL + str(i)], evidence=ev, retrieved_at="2026-10-18")


@pytest.fixture()
def built(tmp_path, monkeypatch):
    for mod in (index,):
        monkeypatch.setattr(mod, "BM25_PATH", tmp_path / "bm25.pkl")
        monkeypatch.setattr(mod, "ENTITIES_PATH", tmp_path / "entities.jsonl")
        monkeypatch.setattr(mod, "VEC_PATH", tmp_path / "vectors.npy")
        monkeypatch.setattr(mod, "VEC_META_PATH", tmp_path / "vectors_meta.json")
    monkeypatch.setattr(index, "embed", fake_embed)
    monkeypatch.setattr(config.settings, "qdrant_url", "")
    monkeypatch.setattr(config.settings, "use_llm_expansion", False)
    monkeypatch.setattr(config.settings, "use_llm_explain", False)
    monkeypatch.setattr(search.llm, "available", lambda: False)
    monkeypatch.setattr(config.settings, "min_vector_score", 0.30)
    monkeypatch.setattr(config.settings, "min_coverage", 0.5)
    monkeypatch.setattr(config.settings, "max_per_unit", 2)
    ents = [
        ent(1, "Jane Doe", "person", "Diabetes Technology Lab", ["continuous glucose monitoring", "closed-loop insulin delivery"]),
        ent(2, "Diabetes Technology Lab", "unit", None, ["continuous glucose monitoring"]),
        ent(3, "Max Muster", "person", "Hearing Research Lab", ["cochlear implant"]),
        ent(4, "Ann A", "person", "Big Lab", ["medical image analysis"]),
        ent(5, "Ann B", "person", "Big Lab", ["medical image analysis"]),
        ent(6, "Ann C", "person", "Big Lab", ["medical image analysis"]),
        ent(7, "Small Lab Lead", "person", "Small Lab", ["medical image analysis"], source="dcb"),
    ]
    index.build(ents)
    return ents


def test_lay_term_via_glossary_finds_expert(built):
    r = search.search("glucose sensors")
    assert not r.abstained
    assert "Jane Doe" in [x.person_or_unit for x in r.results]
    assert "continuous glucose monitoring" in r.expanded_terms


def test_every_result_is_sourced(built):
    r = search.search("medical image analysis")
    assert r.results and all(x.sources and all(s.url and s.snippet for s in x.sources) for x in r.results)


def test_fairness_cap_keeps_small_lab_visible(built):
    r = search.search("medical image analysis", k=3)
    names = [x.person_or_unit for x in r.results]
    assert "Small Lab Lead" in names
    assert sum(n.startswith("Ann") for n in names) <= 2


def test_out_of_domain_abstains(built):
    r = search.search("volcano geochemistry iceland")
    assert r.abstained and not r.results


def test_unknown_person_abstains_known_person_found(built):
    assert search.search("Prof. Erika Beispiel glucose").abstained
    r = search.search("Dr. Jane Doe")
    assert not r.abstained and r.results[0].person_or_unit == "Jane Doe"


def test_source_filter(built):
    r = search.search("medical image analysis", sources=["dcb"])
    assert {x.institution for x in r.results} == {"DCB"}


def test_person_unit_graph(built):
    r = search.search("closed-loop insulin delivery")
    jane = next(x for x in r.results if x.person_or_unit == "Jane Doe")
    assert "Diabetes Technology Lab" in jane.related
