# Technical report — Bern Expertise Navigator, `team name`

A deeper write-up than the README: what we built, how it works, and what the numbers say.

- **Challenge:** Bern Economic Development Agency — Research & Expertise Navigator
- **Event:** On-site Liebefeld
- **Team:** `team name` — `member`, `member`, `member`
- **Demo:** `link to video`

## 1. Summary

The canton wants companies to invest in Bern. Its business-development officers receive requests from companies
across many domains, often full of jargon ("needle-free CGM patch, AID integration, CE marking under the MDR"), and
must then find out who in Bern's research landscape could help. We built a navigator for that job:

1. explain the request in plain language, with every technical word explained;
2. match it to researchers, labs, projects and facilities in Bern, each backed by a verbatim sentence on a public
   page;
3. draft the invitation (email in EN/DE/FR or a calendar invite) with only the chosen partners and verified
   "why Bern" facts.

Step 3 produces **two outputs**: a plain explanation for the officer of what she is sending and why, and an
interactive **executive brief** for the company's CEO (shareable private link, one-click PDF). The brief's single goal
is a visit to Bern. It avoids overselling: every statement is a verbatim quote from a public institutional page or a
publication (DOI) listed there, numbered and linked; nothing about money; no claim that anyone has agreed to meet.
The app separates its users clearly: a **public navigator** (the challenge's search deliverable), a **staff
workspace** for the business-development team, and the **brief** the CEO receives.

Headline numbers on our golden set (30 queries, ARTORG + DCB, **without** an LLM): **recall@10 96%**,
**traceability 100%**, **correct abstention 100%**, lay-term/expert-term consistency 71%, median latency 0.11 s on
CPU. Apertus numbers: `TBD` (see §5).

## 2. Architecture

```
public websites ─► crawl ─► classify ─► extract (Apertus | rules) ─► verify ─► index ─► search / explain
                                                                         │
company request ─► plain language (glossary | Apertus) ─► matches ─► pitch & invitation (brief, mailto / .ics)
```

| Component | Module (`src/app/navigator/`) | What it does |
|---|---|---|
| Crawl | `crawl.py` | Config-driven, bounded best-first crawl; robots.txt including wildcard rules; polite delay; content-hash dedup. Text is article extraction, or boilerplate-stripped DOM text when that keeps more, because team grids and member cards are dropped by article extractors. Truncates "more recent projects" teaser blocks. Runs only on explicit command. |
| Classify | `classify.py` | URL rules per source; Apertus only for pages the rules can't place. |
| Extract | `extract.py` | Apertus with JSON-schema output; every value quotes a snippet. |
| Rules baseline | `rules_extract.py` | No-LLM extractor: profile headers, directory cards, contact blocks, team lines, research sentences. Same output format, same verifier. Used when Apertus is unreachable, and as the comparison baseline. |
| Verify | `extract.verify` | Snippet must occur in the page text and contain the value, or the claim is dropped and logged. A relation (person → lab/project) is accepted when the lab/project is the page's own heading and the person's verbatim line is on it. |
| Link | `extract.link_site_structure`, `derive_units` | Site hierarchy as evidence (pages under `/research/aihn/` belong to that lab). Labs that exist only as headings on team pages become lab entities, cited by that heading. |
| Index | `index.py` | BM25 plus `multilingual-e5-base` vectors for each entity profile and each evidence snippet. NumPy store locally, Qdrant in Docker. |
| Search | `search.py` | Glossary and Apertus query analysis; RRF of BM25(query), BM25(expansions) and vectors; matching labs/projects surface their people, with the head of the lab first; fairness cap; cited explanations; abstention. |
| Requests | `plain.py`, `cases.py` | Plain-language analysis, matching (niche filters, senior contacts first), request status (SQLite), email template, `.ics`. |
| Pitch | `brief.py` | Output 1 (officer explanation) and Output 2 (executive brief): chosen partners only; quotes chosen from the partner's or linked project's verbatim sentences that name a topic from the request; publications matched by author surname from 143 DOIs on the institutions' pages; numbered sources. |
| Showcase | `showcase.py` | Research themes with live counts, verified proof points, lab and facility directories. |
| UI | `static/` | Vanilla HTML/CSS/JS, no CDN or build step, EN/DE/FR, light/dark, responsive. |

**Abstention** uses two signals, and both must be weak. The best cosine to the original query must be below 0.825,
**and** at most half the query's words may occur in the top candidates, with no expansion term occurring verbatim.
A person name in the query that matches no indexed entity also triggers abstention. On the golden set,
single-signal thresholds could not separate out-of-scope queries from hard in-scope ones; the combined rule does.

### Target architecture (mandatory)

Deployable as **a) on-premise**, **b) air-gapped** (after the crawl) and **c) sovereign Swiss cloud**:

- One `docker compose` file: API/UI and Qdrant, plus optionally Apertus via the Swiss AI vLLM image
  (`make up-gpu`). Alternatively, any OpenAI-compatible Apertus endpoint operated in Switzerland (`LLM_BASE_URL`).
- **Build time** (network): images, Python wheels, the e5 model (baked into the image), Apertus weights, and the
  crawl of the public websites.
- **Runtime** (no network): pages, entities, vectors, BM25 and the request database are local files. The API runs
  with `HF_HUB_OFFLINE=1`. The UI loads no external resources. Emails go out through the officer's own mail client.
- Hosting is outside the Canton of Bern's ICT, as the brief requires.

## 3. Use of Apertus

- **Model:** `swiss-ai/Apertus-v1.5-8B` (70B is a drop-in via `LLM_NAME`)
- **How it is used:** inference: structured extraction, query understanding, plain-language explanation
- **Where it runs:** vLLM (`ghcr.io/swiss-ai/vllm_apertus_1.5_release`) on one GPU, or a hosted OpenAI-compatible
  Apertus endpoint

| Use | Why AI here | Guard-rail |
|---|---|---|
| Extraction (main use) | Heterogeneous pages (DE/EN, cards, prose); rules alone miss most expertise phrasing | JSON schema; verbatim snippet per value; verifier drops the rest; rules baseline measures the gain |
| Plain-language request summary | The officer is not a domain expert | Sees only the request text; labelled "Summary by Apertus" |
| Explaining jargon | Endless medtech vocabulary | Reviewed glossary first; AI explanations only for missing terms, labelled "AI explanation – check" |
| Query analysis | Lay ↔ technical ↔ DE/FR terms; detecting person names | Only adds search terms; an unknown person leads to abstention |
| Match explanation | Readable "why" | Numbered evidence only; rejected if it cites other evidence; deterministic fallback |

Not AI: the invitation email (template with the chosen partners and verified quotes only), the showcase, ranking.
Temperature 0. The client degrades from `json_schema` to `json_object` to prompt-only JSON, and detects an
unreachable endpoint in about 3 s, so the UI keeps working in rules mode.

## 4. Data

- Public pages of `www.artorg.unibe.ch` (373 pages) and `www.dcberne.com` (54 pages), crawled on 2026-10-18.
  robots.txt was checked for every URL; an audit found 0 disallowed fetches. UniBE awaits the supplied subdomain
  inventory.
- Extracted (rules baseline): 396 entities (282 people, 21 labs, 82 projects, 11 facilities) with 2,414 verbatim snippets.
- Personal data: only what the institutions publish on public team/profile pages (names, roles, work emails).
  Company requests are stored locally and can be deleted. All example requests are fictional.
- Copyright stays with the institutions; `data/` is not in the repository.

## 5. Limitations

- **No Apertus numbers yet.** The development laptop (6 GB GPU) cannot host Apertus 8B and no endpoint was
  configured, so all reported numbers use the rules baseline. Apertus extraction and expansion should improve
  expertise coverage and lay-term twins (71%). The one recall miss ("tiny robots steered by sound waves") needs
  expansion.
- **Golden set bias.** We built the 30 queries ourselves from the same pages and tuned the abstention thresholds on
  them; the numbers are optimistic until others add queries.
- **Rules extractor** heuristics occasionally mistake headings for names or miss relations. The verifier keeps every
  claim traceable but not necessarily complete.
- **Plain language without Apertus** is extractive: the summary repeats the request's own sentences, with glossary
  explanations alongside. Match explanations are English-only in this mode.
- **No authentication** in the prototype; roles are chosen in the browser.
- JavaScript-rendered pages, PDFs and images are not read.

## 6. Reproducibility

```bash
cd src && cp .env.example .env       # set LLM_BASE_URL / LLM_API_KEY (or: make up-gpu)
make up && make demo                 # uses saved pages; crawl first with: make crawl SOURCE=artorg (and dcb)
make test                            # tests, no network / GPU / model download
```

Without Docker: `make setup-local && make demo LOCAL=1 && make serve LOCAL=1`. Reported numbers: CPU only (WSL2,
22 cores, 31 GB RAM), `EXTRACTOR=rules`, e5-base, golden set `src/eval/golden_set.yaml`, crawl of 2026-10-18,
commit `TBD`.

## License

Creative Commons Attribution 4.0 (CC-BY-4.0). All HackApertus projects are open-sourced.
