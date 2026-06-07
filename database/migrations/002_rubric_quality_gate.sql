-- 002_rubric_quality_gate.sql
-- Adds the 'filtered' application status (quality-gate + sub-threshold jobs)
-- and the score_breakdown JSONB column (6-dimension rubric).

-- Enum value must be added in its own statement and committed before use.
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'filtered';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
