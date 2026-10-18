"""Stage 4 — indexing: local multilingual embeddings + BM25 (keyword).

Vectors: one point per entity "profile" plus one per evidence snippet, so a short expertise
sentence is matched on its own instead of being diluted in a long profile. Search keeps the
best-scoring point per entity.

Vector store: Qdrant when QDRANT_URL is set (docker compose), otherwise an in-process NumPy
matrix in data/ (zero services, fine for tens of thousands of points).
"""
from __future__ import annotations

import json
import pickle
import re
from functools import lru_cache

import numpy as np
from rank_bm25 import BM25Okapi

from .config import DATA_DIR, settings
from .schema import Entity

BM25_PATH = DATA_DIR / "bm25.pkl"
ENTITIES_PATH = DATA_DIR / "entities.jsonl"
VEC_PATH = DATA_DIR / "vectors.npy"
VEC_META_PATH = DATA_DIR / "vectors_meta.json"

_STOP = set("""the and for with von und der die das des den dem ein eine einer im in of on to at by
a an or oder zu zur zum mit für fur bei aus le la les de du et en un une des dans au aux pour sur
non""".split())


def tokenize(s: str) -> list[str]:
    return [t for t in re.findall(r"\w{2,}", s.lower()) if t not in _STOP]


@lru_cache(maxsize=1)
def embedder():
    from sentence_transformers import SentenceTransformer  # lazy: heavy import
    return SentenceTransformer(settings.embed_model, device="cpu")


def embed(texts: list[str], query: bool = False) -> np.ndarray:
    # e5 models expect "query: " / "passage: " prefixes
    prefix = ("query: " if query else "passage: ") if "e5" in settings.embed_model else ""
    return embedder().encode([prefix + t for t in texts], normalize_embeddings=True,
                             batch_size=32, show_progress_bar=not query and len(texts) > 64)


def entity_passages(e: Entity) -> list[str]:
    head = f"{e.name}. {e.role or ''} {e.unit or ''} {e.institute or ''}".strip()
    profile = head + ". " + "; ".join(e.expertise + e.projects + e.infrastructure)
    snippets = dict.fromkeys(ev.snippet for ev in e.evidence if ev.field not in ("name", "email"))
    return [profile, *(f"{e.name}: {s}" for s in snippets)]


@lru_cache(maxsize=1)
def qdrant():
    from qdrant_client import QdrantClient
    return QdrantClient(url=settings.qdrant_url)


def build(entities: list[Entity]) -> None:
    ENTITIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ENTITIES_PATH.open("w") as fh:
        for e in entities:
            fh.write(e.model_dump_json() + "\n")

    docs = [e.search_text() for e in entities]
    with BM25_PATH.open("wb") as fh:
        pickle.dump({"ids": [e.id for e in entities], "bm25": BM25Okapi([tokenize(d) for d in docs])}, fh)

    meta: list[dict] = []
    texts: list[str] = []
    for e in entities:
        for t in entity_passages(e):
            meta.append({"entity_id": e.id, "source": e.source, "type": e.entity_type})
            texts.append(t)
    vecs = embed(texts).astype(np.float32)

    if settings.qdrant_url:
        from qdrant_client.models import Distance, PointStruct, VectorParams
        q = qdrant()
        if q.collection_exists(settings.collection):
            q.delete_collection(settings.collection)
        q.create_collection(settings.collection, vectors_config=VectorParams(size=vecs.shape[1], distance=Distance.COSINE))
        for i in range(0, len(meta), 512):
            q.upsert(settings.collection, points=[
                PointStruct(id=j, vector=vecs[j].tolist(), payload=meta[j]) for j in range(i, min(i + 512, len(meta)))])
    np.save(VEC_PATH, vecs)
    VEC_META_PATH.write_text(json.dumps(meta))
    store = "Qdrant" if settings.qdrant_url else "local NumPy store"
    print(f"[index] {len(entities)} entities, {len(meta)} vectors ({store}, {settings.embed_model}) + BM25")


def _mtime(p) -> float:
    return p.stat().st_mtime if p.exists() else 0.0


# The API process picks up a re-index done by the CLI without restarting (cache keyed on mtime)
@lru_cache(maxsize=1)
def _vectors_at(_mt: float):
    if not VEC_PATH.exists():
        return None, []
    return np.load(VEC_PATH), json.loads(VEC_META_PATH.read_text())


def _load_vectors():
    return _vectors_at(_mtime(VEC_META_PATH))


def vector_search(qvec: np.ndarray, limit: int, sources: list[str] | None = None) -> list[tuple[str, float]]:
    """Return (entity_id, cosine) for the best `limit` points (several points may share an entity)."""
    if settings.qdrant_url:
        from qdrant_client.models import FieldCondition, Filter, MatchAny
        flt = Filter(must=[FieldCondition(key="source", match=MatchAny(any=sources))]) if sources else None
        hits = qdrant().query_points(settings.collection, query=qvec.tolist(), limit=limit, query_filter=flt).points
        return [(h.payload["entity_id"], float(h.score)) for h in hits]
    vecs, meta = _load_vectors()
    if vecs is None or not len(meta):
        return []
    scores = vecs @ qvec.astype(np.float32)
    if sources:
        mask = np.array([m["source"] in sources for m in meta])
        scores = np.where(mask, scores, -1.0)
    top = np.argsort(-scores)[:limit]
    return [(meta[i]["entity_id"], float(scores[i])) for i in top if scores[i] > -1]


@lru_cache(maxsize=1)
def _entities_at(_mt: float) -> dict[str, Entity]:
    if not ENTITIES_PATH.exists():
        return {}
    return {e.id: e for e in (Entity.model_validate_json(l) for l in ENTITIES_PATH.open() if l.strip())}


def load_entities() -> dict[str, Entity]:
    return _entities_at(_mtime(ENTITIES_PATH))


@lru_cache(maxsize=1)
def _bm25_at(_mt: float):
    if not BM25_PATH.exists():
        return None
    with BM25_PATH.open("rb") as fh:
        return pickle.load(fh)


def load_bm25():
    return _bm25_at(_mtime(BM25_PATH))
