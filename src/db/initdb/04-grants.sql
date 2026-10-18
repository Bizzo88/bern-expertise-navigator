-- Least privileges for bern_app: DML only, no DDL, no superuser.
-- App schema
GRANT USAGE ON SCHEMA nav TO bern_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nav TO bern_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nav TO bern_app;
-- PG17+: ANALYZE/VACUUM/REINDEX after a bulk reindex, without ownership
GRANT MAINTAIN ON ALL TABLES IN SCHEMA nav TO bern_app;
REVOKE INSERT, UPDATE, DELETE ON nav.schema_migrations FROM bern_app;   -- migrations are applied by the owner
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA nav
  GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON TABLES TO bern_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA nav
  GRANT USAGE, SELECT ON SEQUENCES TO bern_app;

-- AGE: catalog (cypher(), agtype) + DML on the graph's label tables
GRANT USAGE ON SCHEMA ag_catalog TO bern_app;
GRANT USAGE ON SCHEMA expertise_graph TO bern_app;
GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON ALL TABLES IN SCHEMA expertise_graph TO bern_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA expertise_graph TO bern_app;
