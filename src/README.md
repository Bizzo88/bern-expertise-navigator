# Bern Expertise Navigator

**Hack Apertus 2026 · Bern Economic Development Agency challenge**

A tool for the canton's business-development team to **bring companies to Bern**.

A company writes in ("we build a needle-free CGM patch and need a clinical study partner…"). The officer handling it
is not a medtech expert. The navigator:

1. **Understands.** It explains the request in plain language, with every technical word explained (EN/DE/FR).
2. **Matches.** It finds the right researchers, labs, projects and facilities in Bern from the public websites of
   UniBE, ARTORG and Diabetes Center Berne. **Every result is linked to the page and the verbatim sentence that
   supports it.**
3. **Gets a technical review.** A technical colleague confirms or rejects each proposed partner, with comments.
4. **Invites.** It drafts an invitation email (EN/DE/FR) with only the approved partners and verified "why Bern"
   facts, or a calendar invite for a call.

**Explore Bern** shows the ecosystem without a specific request: research strengths with live counts, facilities
companies can use, a lab directory with the head of each lab, and proof points quoted from the institutions' own
pages.

Built on **Apertus v1.5**, the Swiss open LLM. Fully self-hosted, so no data leaves Switzerland. Without an Apertus
endpoint everything still works, using a reviewed glossary and deterministic rules, and the UI says so.

---

## Quick start

All commands run from this `src/` directory. Apertus is reached through an OpenAI-compatible endpoint set with
`LLM_NAME`, `LLM_BASE_URL` and `LLM_API_KEY` in `.env`.

```bash
cp .env.example .env            # set LLM_BASE_URL / LLM_API_KEY, or use make up-gpu
make up                         # API + UI on http://localhost:8080 (Apertus at $LLM_BASE_URL)
make up-gpu                     # same, plus Apertus 8B served locally by vLLM (NVIDIA GPU, >= 16 GB)
make demo                       # from the saved pages: extract -> index -> eval (never crawls)
make test                       # unit tests: no GPU, no network, no model download
```

**Without Docker** (Python 3.11): `make setup-local`, then add `LOCAL=1` to any target, e.g.
`make demo LOCAL=1` and `make serve LOCAL=1`.

**Crawling is always explicit.** `make crawl SOURCE=<name>` fetches one source. Sources already saved in
`data/pages/` are skipped unless you add `RECRAWL=1`. No other target touches the network.

## Using it

| Who | Where | What |
|---|---|---|
| Business development | **Requests** | Pipeline board → **New request** (paste the company's message; three fictional examples included) → guided 4-step request page |
| Technical reviewer | **Review** | Queue of requests in review. Per partner: *Suitable / Not suitable*, a comment and the full technical evidence. Then **Approve** or **Request changes** |
| Anyone | **Explore Bern** | Search in any language, research strengths, facilities, labs, proof points. From a request, *Find more in Explore* lets you add partners to it |

Set your name, email and role with the button at the top right. This is stored only in the browser. For a
single-person demo, *Open as reviewer* on a request switches roles. The prototype has no login.

Emails are never sent by the server: **Open in email app** uses `mailto:` and the officer sends from their own mail
client. **Calendar invite** downloads a standard `.ics` file.

## Pipeline

```
public websites ─► 1 crawl ─► 2 classify ─► 3 extract ─────────────► 4 index ─► 5 search & explain
 sources.yaml       robots.txt   URL rules +   Apertus (JSON schema)     BM25 +      hybrid RRF, lab→people,
                    (explicit)   Apertus       or rules baseline;        e5 vectors  fairness cap, cited "why",
                                               verbatim snippet or drop  (per snippet) honest abstention
                                                                                 │
             company request ─► plain language (glossary / Apertus) ─► matches ─► review ─► invitation
```

| Stage | Module | Where Apertus is used, and why |
|---|---|---|
| 1 Crawl | `crawl.py` | none (deterministic, polite, bounded; robots.txt incl. wildcards; directory pages kept via DOM text) |
| 2 Classify | `classify.py` | only for pages the URL rules can't classify |
| 3 Extract | `extract.py`, `rules_extract.py` | **Main use.** Page → entities as constrained JSON; each value must quote the page verbatim or it is dropped. `rules_extract.py` is the no-LLM baseline that passes through the same verifier |
| 4 Index | `index.py` | none (local multilingual embeddings + BM25) |
| 5 Search | `search.py` | Query analysis (synonyms, lay terms, DE/EN/FR, person names) and match explanations written only from the cited evidence |
| Requests | `plain.py`, `cases.py` | Plain-language summary of a company request plus explanations of terms the glossary lacks (labelled *AI explanation – check*). Emails are a deterministic template: no generated claims |
| Showcase | `showcase.py` | none: live counts from the index, and proof points re-verified against the saved pages at startup |

## Storage backends

`navigator/storage.py` picks the backend from `DATABASE_URL` (capability matrix in its docstring):

- empty (default): files in `data/` (entities.jsonl, BM25 pickle, NumPy or Qdrant, SQLite cases), as before;
- set: Postgres from `db/` (`nav` tables, pgvector, FTS, AGE graph `expertise_graph`). `index --source X`
  then replaces only source X, in one transaction. Requires the migrations in `db/migrations/`.

Postgres tests: `TEST_DATABASE_URL=postgresql://bern_app:<pw>@127.0.0.1:<port>/bern pytest -q tests/test_pg_backend.py`
(wipes that database; use a throwaway container).

## How we meet the success criteria

| # | Criterion | Mechanism | Check |
|---|---|---|---|
| 1 | ≥ 80% expected experts in top 10 | Hybrid BM25 + vectors, RRF, lab → head-of-lab propagation | `make eval` → `recall_at_k` |
| 2 | Synonyms / lay terms | `config/glossary.yaml` + Apertus expansion + multilingual embeddings | `synonym_twins_consistent` |
| 3 | 100% traceable | Snippet must occur verbatim on the crawled page, else dropped (`data/rejected.jsonl`) | `traceability`, `tests/` |
| 4 | Structured results | `SearchResult`: person/unit, role, affiliation, institution, expertise, projects, infrastructure, contact, why, related, sources, confidence | `/docs` |
| 5 | All three sources | `sources.yaml`: `unibe`, `artorg`, `dcb` | `/stats` |
| 6 | Easy to extend | One YAML block, then `make crawl SOURCE=<name> && make pipeline` | live |
| — | Honest when unsure | Weak semantic match **and** low word coverage → "no verifiable source"; unknown person name → "no such person" | out-of-domain queries in the golden set |
| — | Fair discoverability | Max `MAX_PER_UNIT` people and `MAX_PER_UNIT` labs/projects per unit in the top k | config |

## Adding a new institution

1. Add a block to `config/sources.yaml` (name, label, domains, seeds; optional `page_types` URL patterns).
2. `make crawl SOURCE=<name>`, then `make pipeline`. No code changes.

Proof points, research themes and engagement routes are in `config/showcase.yaml`. Each quote is checked verbatim
against the saved page, and anything unverifiable is dropped automatically. The plain-language glossary is
`config/plain_glossary.yaml` (EN/DE).

## API (selection)

| Endpoint | Purpose |
|---|---|
| `GET /search?q=&k=&source=&type=` | Search; every result has `sources[{url, snippet, field}]` |
| `GET /entity/{id}` | Full entity with all evidence and linked people/labs |
| `GET /showcase` | Landing data: themes (live), verified proof points, labs, facilities |
| `POST /cases` · `GET /cases` · `GET /cases/{id}` | Company requests |
| `POST /cases/{id}/selection` · `/review-request` · `/review` · `/draft` · `/outcome` | Workflow steps |
| `GET /cases/{id}/invite.ics` | Calendar invite |
| `GET /glossary?lang=` · `GET /health` · `GET /stats` | Support |

## Repository layout

```
config/        sources.yaml · unibe_subdomains.txt · glossary.yaml · plain_glossary.yaml · showcase.yaml · example_requests.yaml
app/navigator/ config · schema · llm · crawl · classify · extract · rules_extract · index · search · plain · cases · showcase · api · cli
app/navigator/static/  index.html · app.css · app.js   (no build step, no CDN: works air-gapped)
eval/          golden_set.yaml · run_eval.py
tests/         verifier, robots.txt, rules extractor, offline search, LLM client, request workflow
data/          (generated, git-ignored) pages/, entities.jsonl, vectors.npy, bm25.pkl, cases.db, eval_report.json
```

## Sovereignty, cost and scale

- **Model:** Apertus v1.5 8B (Apache 2.0) on one ~16 GB GPU in FP8. 70B is optional for better extraction.
- **No external services:** local embeddings (`multilingual-e5-base`, baked into the image), local vectors, local
  SQLite for requests. The UI loads nothing from the internet.
- **Cost:** LLM work at indexing time is one call per page, cached per page. A search costs at most one expansion
  call plus short explanation calls, and both can be switched off. Token usage is written to
  `data/extract_stats*.json` and `data/eval_report.json`.

## Compliance

- Public pages only; robots.txt (with wildcard rules) respected; polite delay; identifiable user agent; crawling only
  on explicit command.
- Only what the institutions already publish; every record points to its source page. Copyright stays with them.
- nDSG / GDPR: no tracking and no query logging. Company requests stay in the local database and can be deleted from
  the UI. Example requests are fictional.
- Open source (Apache-2.0); outputs Open Commons (Hack Apertus T&C §6).
