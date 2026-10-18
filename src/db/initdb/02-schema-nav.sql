-- Relational schema "nav": the Navigator's actual domain (schema.py, cases.py, index.py, search.py).
CREATE SCHEMA IF NOT EXISTS nav;
SET search_path = nav, public;

-- Multilingual FTS (EN/DE/FR): simple parser + unaccent, no language-specific stemming.
CREATE TEXT SEARCH CONFIGURATION nav.simple_unaccent (COPY = pg_catalog.simple);
ALTER TEXT SEARCH CONFIGURATION nav.simple_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH public.unaccent, pg_catalog.simple;

-- array_to_string is STABLE: IMMUTABLE wrapper (safe on text[]) for generated columns.
CREATE FUNCTION nav.arr_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT coalesce(array_to_string($1, ' '), '') $$;

-- Source (formerly YAML) --------------------------------------------------------
CREATE TABLE nav.source (
  name        text PRIMARY KEY CHECK (name ~ '^[a-z0-9_-]+$'),
  label       text NOT NULL,
  domains     text[] NOT NULL DEFAULT '{}',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Page ----------------------------------------------------------------------
CREATE TABLE nav.page (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url         text NOT NULL UNIQUE,
  source      text NOT NULL REFERENCES nav.source(name) ON UPDATE CASCADE,
  title       text NOT NULL DEFAULT '',
  text        text NOT NULL,
  fetched_at  timestamptz NOT NULL,
  lang        text,
  page_type   text CHECK (page_type IN ('person','unit','project','infrastructure','other'))
);
CREATE INDEX page_source_idx ON nav.page(source);

-- Entity --------------------------------------------------------------------
CREATE TABLE nav.entity (
  id              text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{16}$'),   -- sha1 hex[:16]
  entity_type     text NOT NULL CHECK (entity_type IN ('person','unit','project','infrastructure')),
  name            text NOT NULL,
  role            text,
  unit            text,
  institute       text,
  email           text,
  expertise       text[] NOT NULL DEFAULT '{}',
  projects        text[] NOT NULL DEFAULT '{}',
  infrastructure  text[] NOT NULL DEFAULT '{}',
  description     text[] NOT NULL DEFAULT '{}',
  source          text NOT NULL REFERENCES nav.source(name) ON UPDATE CASCADE,
  source_label    text NOT NULL,
  source_urls     text[] NOT NULL DEFAULT '{}',
  retrieved_at    timestamptz NOT NULL,
  extractor       text NOT NULL DEFAULT 'apertus' CHECK (extractor IN ('apertus','rules')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('nav.simple_unaccent'::regconfig, coalesce(name, '')), 'A')
     || setweight(to_tsvector('nav.simple_unaccent'::regconfig,
          coalesce(role, '') || ' ' || coalesce(unit, '') || ' ' || coalesce(institute, '') || ' ' || nav.arr_text(expertise)), 'B')
     || setweight(to_tsvector('nav.simple_unaccent'::regconfig,
          nav.arr_text(projects) || ' ' || nav.arr_text(infrastructure) || ' ' || nav.arr_text(description)), 'C')
  ) STORED
);
CREATE INDEX entity_source_type_idx ON nav.entity(source, entity_type);
CREATE INDEX entity_tsv_idx        ON nav.entity USING gin (tsv);
CREATE INDEX entity_name_trgm_idx  ON nav.entity USING gin (name gin_trgm_ops);
CREATE INDEX entity_expertise_idx  ON nav.entity USING gin (expertise);

-- Evidence: every claim with its verbatim snippet (traceability) ---------------
CREATE TABLE nav.evidence (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id   text NOT NULL REFERENCES nav.entity(id) ON DELETE CASCADE,
  field       text NOT NULL CHECK (field IN ('name','role','unit','institute','email','expertise',
                                              'projects','infrastructure','description')),
  value       text NOT NULL,
  snippet     text NOT NULL,
  url         text NOT NULL,
  page_id     bigint REFERENCES nav.page(id) ON DELETE SET NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('nav.simple_unaccent'::regconfig, snippet)) STORED,
  UNIQUE (entity_id, field, value, url, snippet)
);
CREATE INDEX evidence_entity_idx ON nav.evidence(entity_id);
CREATE INDEX evidence_page_idx   ON nav.evidence(page_id);
CREATE INDEX evidence_tsv_idx    ON nav.evidence USING gin (tsv);

-- Rejected claim: what the validator discarded, with the reason ---------------
CREATE TABLE nav.rejected_claim (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source      text NOT NULL REFERENCES nav.source(name) ON UPDATE CASCADE,
  url         text NOT NULL,
  field       text NOT NULL,
  value       text NOT NULL,
  snippet     text NOT NULL DEFAULT '',
  reason      text NOT NULL DEFAULT 'snippet_not_found',
  page_id     bigint REFERENCES nav.page(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rejected_claim_source_idx ON nav.rejected_claim(source, url);

-- Embedding passages (replaces Qdrant/NumPy) ------------------------------
-- 1 'profile' point per entity + 1 'evidence' point per unique snippet (no name/email).
CREATE TABLE nav.passage (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id    text NOT NULL REFERENCES nav.entity(id) ON DELETE CASCADE,
  evidence_id  bigint REFERENCES nav.evidence(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('profile','evidence')),
  text         text NOT NULL,
  text_md5     text GENERATED ALWAYS AS (md5(text)) STORED,
  embedding    vector(768) NOT NULL,
  embed_model  text NOT NULL DEFAULT 'intfloat/multilingual-e5-base',
  source       text NOT NULL,           -- denormalized for filtering
  entity_type  text NOT NULL CHECK (entity_type IN ('person','unit','project','infrastructure')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'profile') = (evidence_id IS NULL)),
  UNIQUE (entity_id, kind, embed_model, text_md5)
);
CREATE INDEX passage_embedding_hnsw ON nav.passage
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX passage_source_type_idx ON nav.passage(source, entity_type);
CREATE INDEX passage_entity_idx      ON nav.passage(entity_id);
CREATE INDEX passage_evidence_idx    ON nav.passage(evidence_id);

-- Case (company requests; formerly SQLite JSON blob) ---------------------------
CREATE TABLE nav."case" (
  id               text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{10}$'),   -- uuid hex[:10]
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL DEFAULT 'new' CHECK (status IN
                     ('new','in_review','changes_requested','approved','contacted','call_scheduled','closed')),
  company          text NOT NULL DEFAULT '',
  contact_name     text NOT NULL DEFAULT '',
  contact_email    text NOT NULL DEFAULT '',
  country          text NOT NULL DEFAULT '',
  request_text     text NOT NULL,
  analysis         jsonb,                    -- RequestAnalysis
  no_match_message text,
  reviewer         text NOT NULL DEFAULT '',
  review_note      text NOT NULL DEFAULT '', -- officer -> reviewer
  review_comment   text NOT NULL DEFAULT '', -- reviewer -> officer
  outreach         jsonb
);
CREATE INDEX case_status_idx ON nav."case"(status, updated_at DESC);

CREATE TABLE nav.case_match (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id      text NOT NULL REFERENCES nav."case"(id) ON DELETE CASCADE,
  entity_id    text REFERENCES nav.entity(id) ON DELETE SET NULL,  -- the snapshot survives a reindex
  rank         int  NOT NULL CHECK (rank >= 0),
  name         text NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('person','unit','project','infrastructure')),
  role         text,
  unit         text,
  institution  text,
  why          text NOT NULL DEFAULT '',
  plain        text NOT NULL DEFAULT '',
  url          text,
  contact      text,
  confidence   real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  via          text,
  selected     boolean NOT NULL DEFAULT false,
  review       text CHECK (review IN ('ok','no')),
  review_note  text NOT NULL DEFAULT '',
  UNIQUE (case_id, rank)
);
CREATE INDEX case_match_entity_idx ON nav.case_match(entity_id);

CREATE TABLE nav.case_event (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id  text NOT NULL REFERENCES nav."case"(id) ON DELETE CASCADE,
  at       timestamptz NOT NULL DEFAULT now(),
  actor    text NOT NULL DEFAULT '',
  kind     text NOT NULL,
  text     text NOT NULL DEFAULT ''
);
CREATE INDEX case_event_case_idx ON nav.case_event(case_id, at);

-- automatic updated_at
CREATE FUNCTION nav.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER source_touch BEFORE UPDATE ON nav.source FOR EACH ROW EXECUTE FUNCTION nav.touch_updated_at();
CREATE TRIGGER entity_touch BEFORE UPDATE ON nav.entity FOR EACH ROW EXECUTE FUNCTION nav.touch_updated_at();
CREATE TRIGGER case_touch   BEFORE UPDATE ON nav."case" FOR EACH ROW EXECUTE FUNCTION nav.touch_updated_at();

-- Migrations ----------------------------------------------------------------
CREATE TABLE nav.schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
