INSERT INTO nav.schema_migrations(version) VALUES ('0001_initial') ON CONFLICT DO NOTHING;
-- the initdb schema already includes these later migrations
INSERT INTO nav.schema_migrations(version) VALUES ('0002_remove_technical_review') ON CONFLICT DO NOTHING;
