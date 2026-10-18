-- Extensions (DB "bern"). AGE is already in shared_preload_libraries: no per-session LOAD.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Nobody creates objects in public except the owner.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
