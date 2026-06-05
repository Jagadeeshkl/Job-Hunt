-- Review queue support: a "dismissed" status (user-not-interested, distinct from
-- a company "rejected") and a "starred" shortlist flag.
-- Apply once against Supabase (psql or the SQL editor).

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'dismissed';

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

-- Speeds up the review queue (status = 'matched') and the starred shortlist.
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_starred ON applications (starred) WHERE starred = true;
