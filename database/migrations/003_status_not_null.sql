-- 003_status_not_null.sql
-- Enforce NOT NULL on applications.status.
--
-- The dashboard list API filters with `status NOT IN ('dismissed','filtered')`,
-- which evaluates to NULL (not TRUE) for a NULL status — so any row with a NULL
-- status would silently disappear from every default view. The column already
-- defaults to 'scraped' and nothing writes NULL, so this just makes the
-- invariant explicit and matches database/schema.sql.
-- Apply once against Supabase (psql or the SQL editor).

UPDATE applications SET status = 'scraped' WHERE status IS NULL;

ALTER TABLE applications ALTER COLUMN status SET NOT NULL;
