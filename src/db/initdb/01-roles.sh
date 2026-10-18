#!/usr/bin/env bash
# Application role: password from env (APP_DB_PASSWORD), never in files.
set -euo pipefail
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD not set}"

# The password is passed as a psql variable (:'app_pw' => quoted literal): no shell interpolation in the SQL.
psql -v ON_ERROR_STOP=1 -v app_pw="$APP_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE bern_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bern_app')
\gexec
ALTER ROLE bern_app CONNECTION LIMIT 50;
ALTER ROLE bern_app SET search_path = nav, ag_catalog, public;
ALTER ROLE bern_app SET statement_timeout = '60s';
REVOKE ALL ON DATABASE bern FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE bern TO bern_app;
SQL
