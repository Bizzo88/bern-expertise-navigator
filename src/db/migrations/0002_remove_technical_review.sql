-- 0002: remove the technical-review step (requests go: understand -> choose partners -> pitch & invite).
-- For databases created before this change. Fresh installs already get this schema from initdb/.
-- Run as postgres:  docker compose exec -T db psql -U postgres -d bern < migrations/0002_remove_technical_review.sql
BEGIN;

-- requests that were waiting for / back from a review continue as ordinary open requests
UPDATE nav."case" SET status = 'new' WHERE status IN ('in_review', 'changes_requested', 'approved');

ALTER TABLE nav."case" DROP CONSTRAINT IF EXISTS case_status_check;
ALTER TABLE nav."case" ADD CONSTRAINT case_status_check CHECK (status IN ('new','contacted','call_scheduled','closed'));

ALTER TABLE nav."case"      DROP COLUMN IF EXISTS reviewer,
                            DROP COLUMN IF EXISTS review_note,
                            DROP COLUMN IF EXISTS review_comment;
ALTER TABLE nav.case_match  DROP COLUMN IF EXISTS review,
                            DROP COLUMN IF EXISTS review_note;

INSERT INTO nav.schema_migrations(version) VALUES ('0002_remove_technical_review') ON CONFLICT DO NOTHING;
COMMIT;
