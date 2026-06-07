# Design: Multi-dimension Scoring Rubric + Quality Gate

**Date:** 2026-06-07
**Project:** job-agent (Autonomous Job Agent)
**Status:** Approved — ready for implementation plan

## Goal

Two enhancements to the matching pipeline, borrowed from career-ops (explainable
A–F rubric) and JustHireMe (deterministic quality gate). Both are designed to add
**zero new Gemini requests** and no new paid services:

1. **Multi-dimension explainable scoring rubric** — the per-job Gemini score
   becomes 6 sub-scores with reasons, stored in one new JSONB column and shown in
   the dashboard Review card. Reuses the existing scoring call.
2. **Deterministic quality gate** — plain JS in WF01 drops senior-only / thin /
   spam jobs *before* Gemini scoring, lowering Gemini usage.

Net effect on Gemini usage: **down** (gate trims jobs; rubric reuses the same call).

## Non-goals

- No new data sources (HN/RSS/Reddit) — explicitly excluded (adds Gemini calls).
- No interview-prep / compensation / outreach generators — excluded (each adds
  Gemini calls).
- No auto-apply.
- "Stale posting" gate rule is excluded (ATS dates unreliable).

## Context (current state)

- Live matching runs in **n8n Cloud WF01** "01 — Daily Scrape & Match"
  (id `ZZPsOF8vwttSIuZz`). Flow:
  `…Filter Real Jobs → Insert One by One (splitInBatches 1) → Insert Job to
  Supabase → Get Unscored Jobs (status='scraped', limit 30) → Score Each Job →
  Prepare Gemini Request → Score with Gemini → Parse Gemini Score → Save Match
  Score`.
- The scorer only ever pulls `status='scraped'`, so anything not in that status is
  never sent to Gemini.
- Supabase `applications` table; `application_status` enum already includes
  `dismissed` (migration 001). `match_score`, `match_justification`,
  `matched_skills`, `missing_skills` columns exist.
- Dashboard Review card (`dashboard/app/review/page.tsx`) renders matched/missing
  skills + `match_justification` ("Why it matched").
- Repo agents (`agents/matcher/prompts.ts`, `agents/matcher/index.ts`) are the
  Docker-reference path (not live) but should be kept in parity.

## Design

### 1. Quality gate (WF01)

New **"Quality Gate"** Code node between *Filter Real Jobs* and *Insert One by One*.
Pure JavaScript, applied per item. Rejected jobs are **kept** (audit trail) but
marked so the scorer skips them.

Rules (all tunable constants at top of the node):
- **Senior-only title:** title matches `/\b(staff|principal|lead|director|vp|vice
  president|head|manager)\b/i` → reject. "Senior" is intentionally NOT rejected
  (the rubric's seniority sub-score judges those).
- **Thin description:** `jd_text.length < 300` → reject.
- **Spam / non-target:** `jd_text`/title matches `/(unpaid|commission only|MLM|
  pyramid)/i`, OR title contains none of the AI/ML keyword set already used in
  WF01 → reject.

Behavior:
- Rejected: set `json.status = 'filtered'` and
  `json.match_justification = 'Filtered: <reason>'`.
- Passing: leave `json.status = 'scraped'`.
- ALL items still pass through to *Insert One by One* → *Insert Job to Supabase*
  (autoMap inserts the `status`). Because *Get Unscored Jobs* queries
  `status='scraped'`, filtered rows are never scored. **Zero Gemini.**
- Duplicate `jd_url` rows already error-continue on insert, so their status is
  unaffected — acceptable.

### 2. Rubric scoring (WF01)

Six dimensions, each 0–100 with a one-line reason:
`stack_fit, seniority, location, compensation, evidence, mission`.

Default weights (sum = 1.0), tunable:
`stack_fit 0.30 · evidence 0.20 · seniority 0.20 · mission 0.15 · location 0.10 ·
compensation 0.05`.

- **Prepare Gemini Request:** prompt asks for JSON:
  ```json
  {
    "dimensions": {
      "stack_fit":    {"score": 0-100, "reason": "..."},
      "seniority":    {"score": 0-100, "reason": "..."},
      "location":     {"score": 0-100, "reason": "..."},
      "compensation": {"score": 0-100, "reason": "..."},
      "evidence":     {"score": 0-100, "reason": "..."},
      "mission":      {"score": 0-100, "reason": "..."}
    },
    "matched_skills": ["..."],
    "missing_skills": ["..."]
  }
  ```
  Same single call; candidate profile string unchanged.
- **Parse Gemini Score:**
  - `match_score = round(Σ weight_i * dimensions[i].score)`.
  - `score_breakdown = dimensions` object.
  - `status = match_score >= 60 ? 'matched' : 'scraped'`.
  - `match_justification` = the six dimension reasons joined as bullet lines
    (keeps the existing "Why" display populated).
  - Defensive defaults if a dimension is missing (treat as 0 / "n/a").
- **Save Match Score:** add field `score_breakdown` = `JSON.stringify($json.score_breakdown)`
  alongside existing `match_score`, `match_justification`, `matched_skills`,
  `missing_skills`, `status`.

### 3. Migration `002_rubric_quality_gate.sql` (Supabase)

```sql
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'filtered';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
```

Run in the Supabase SQL editor (same process as migration 001). Note: adding an
enum value must be committed before it is used by inserts — run the migration
before publishing the updated WF01.

### 4. Dashboard

- **Types:** add `score_breakdown?: Record<string,{score:number;reason:string}> | null`
  to the Review job interface (and the Application interface if shown in the table).
- **Review card** (`app/review/page.tsx`): new "Score breakdown" section rendering
  the 6 dimensions, each as a label + 0–100 bar + reason. Bar color by score band
  (e.g. ≥75 success, 50–74 primary, <50 muted/danger). If `score_breakdown` is
  null (older rows), fall back to the current "Why it matched" text.
- **`/api/applications`** (`app/api/applications/route.ts`): exclude
  `status='filtered'` from the default list (same JS filter that hides
  `dismissed`).
- Counts (`/api/counts`) unaffected (review = `status='matched'`).
- ApplicationTable rubric display is optional/secondary.

### 5. Repo agents (parity, secondary)

Mirror the rubric in `agents/matcher/prompts.ts` (prompt) and
`agents/matcher/index.ts` (weighted-average + `score_breakdown` write), and add a
shared quality-gate helper for the Docker path. Live cloud is the source of truth;
this is for consistency only.

## Data flow (after change)

```
scrape → Filter Real Jobs → [Quality Gate] → Insert (status scraped|filtered)
  → Get Unscored (scraped only) → Gemini (6-dim rubric) → weighted avg
  → Save (match_score + score_breakdown + status) → Review card renders rubric
```

## Cost / usage impact

- Gemini **requests/day:** unchanged per scored job; fewer jobs scored (gate) →
  net **decrease**.
- Gemini **tokens:** prompt/response modestly larger (6 reasons) but replaces the
  prior justification text — roughly flat, well within TPM.
- Supabase: one JSONB column (small) + filtered rows retained (negligible at
  current volume).
- n8n executions: unchanged (gate runs inside the existing scrape path; no new
  trigger or source).

## Risks / mitigations

- **Enum-before-use:** run migration 002 before publishing WF01, else inserts with
  `status='filtered'` fail. Mitigation: sequence migration first.
- **Gemini returns malformed JSON:** Parse node already strips fences and
  try/catches; keep the fallback (score 0 / status scraped) so a bad parse doesn't
  poison data.
- **Over-aggressive gate:** "senior-only" could drop borderline-good roles.
  Mitigation: keep "Senior", make the regex a top-of-node constant, and filtered
  rows remain in DB for audit.
- **Older rows lack `score_breakdown`:** Review card falls back to the existing
  "Why" text.

## Acceptance criteria

1. Migration 002 applied; `score_breakdown` column + `filtered` enum value exist.
2. A WF01 run marks at least the obvious senior/thin/spam jobs as `filtered` and
   never sends them to Gemini.
3. Scored jobs have a `score_breakdown` with all 6 dimensions and a `match_score`
   equal to the weighted average (±1 rounding).
4. Review card shows the 6-dimension breakdown with bars + reasons; old rows still
   render via the fallback.
5. Filtered jobs do not appear in the Applications list or Review queue.
6. No increase in Gemini requests per run vs. baseline (ideally a decrease).
```
