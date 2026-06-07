# Scoring Rubric + Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WF01's single Gemini match score with a 6-dimension explainable rubric (stored in a new `score_breakdown` JSONB column and shown in the Review card), and add a deterministic pre-Gemini quality gate that marks senior/thin/spam jobs as `filtered` — both with zero new Gemini requests.

**Architecture:** All scoring logic lives in n8n Cloud **WF01** (`ZZPsOF8vwttSIuZz`). A new Quality Gate Code node sets `status='filtered'` before the scorer (which only pulls `status='scraped'`), so filtered jobs never reach Gemini. The existing Gemini scoring call is reused — its prompt now asks for 6 sub-scores; the Parse node computes a weighted-average `match_score` and a `score_breakdown` object; sub-60 jobs become `filtered` (scored once, recoverable). The Next.js dashboard renders the breakdown and adds a Filtered/Low-score view with a Restore action.

**Tech Stack:** n8n Cloud (Code + Supabase + HTTP nodes) via the n8n MCP, Supabase Postgres, Next.js 15 / React 18 / Tailwind dashboard, Google Gemini REST.

**Testing note:** This codebase has **no unit-test runner** (no jest/vitest in `dashboard/package.json`; agents run via ts-node). Verification therefore uses: `tsc --noEmit` for the dashboard, live HTTP checks against the running dev server, SQL checks for the migration, and n8n test runs for WF01. Steps below reflect that — they are still bite-sized with exact code and exact verification commands.

**Weights (sum 1.0):** `stack_fit 0.30 · evidence 0.20 · seniority 0.20 · mission 0.15 · location 0.10 · compensation 0.05`. **Matched threshold:** `match_score >= 60`. **"Senior" titles are kept** (only Staff/Principal/Lead/Director/VP/Head/Manager are gated).

---

## File / change map

| Area | Change |
|---|---|
| `database/migrations/002_rubric_quality_gate.sql` | **Create** — enum value `filtered` + `score_breakdown jsonb` |
| WF01 cloud (`ZZPsOF8vwttSIuZz`) | **Modify** — add Quality Gate node + rewire; update Prepare/Parse/Save nodes (via n8n MCP) |
| `dashboard/app/api/applications/route.ts` | **Modify** — hide `filtered` by default |
| `dashboard/app/api/counts/route.ts` | **Modify** — add `filtered` count |
| `dashboard/app/review/page.tsx` | **Modify** — render `score_breakdown` block |
| `dashboard/app/filtered/page.tsx` | **Create** — Filtered/Low-score view + Restore |
| `dashboard/components/app-sidebar.tsx` | **Modify** — add "Filtered" nav item + badge |
| `dashboard/lib/score.ts` | **Create** — shared dimension labels/weights + bar color helper |
| `agents/matcher/prompts.ts`, `agents/matcher/index.ts` | **Modify (secondary)** — parity with cloud rubric |
| `agents/scraper/quality-gate.ts` | **Create (secondary)** — shared gate helper for Docker path |

---

## Task 1: Migration 002 — enum value + JSONB column

**Files:**
- Create: `database/migrations/002_rubric_quality_gate.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 002_rubric_quality_gate.sql
-- Adds the 'filtered' application status (quality-gate + sub-threshold jobs)
-- and the score_breakdown JSONB column (6-dimension rubric).

-- Enum value must be added in its own statement and committed before use.
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'filtered';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
```

- [ ] **Step 2: Apply it in Supabase**

Run the file's contents in the Supabase SQL editor (project ref `akphenmifyihvsylntsw`), the same way migration 001 was applied. (The Supabase MCP is not connected, so this is an operator step — paste and Run.)

- [ ] **Step 3: Verify the schema changed**

In a terminal where the dashboard env is loaded, confirm via the running dev server (start it if needed per CLAUDE.md), or run this check against the API after Task 7. Minimal direct check — Supabase SQL editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='applications' AND column_name='score_breakdown';
-- expect: 1 row

SELECT unnest(enum_range(NULL::application_status));
-- expect the list to include: filtered
```
Expected: `score_breakdown` present; `filtered` in the enum.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/002_rubric_quality_gate.sql
git commit -m "feat(db): migration 002 — filtered status + score_breakdown column"
```

---

## Task 2: WF01 — add the Quality Gate node + rewire

**Files:**
- Modify: WF01 cloud workflow `ZZPsOF8vwttSIuZz` (via n8n MCP `update_workflow`)

Current connection to change: `Filter Real Jobs → Insert One by One`. New chain: `Filter Real Jobs → Quality Gate → Insert One by One`.

- [ ] **Step 1: Add the Quality Gate node**

Call `mcp__n8n__update_workflow` with `workflowId: "ZZPsOF8vwttSIuZz"` and this single `addNode` operation:

```json
{
  "type": "addNode",
  "node": {
    "name": "Quality Gate",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [510, 280],
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": "// Quality Gate — drop senior/thin/spam jobs BEFORE Gemini.\n// Failing jobs are kept but marked status='filtered' so the scorer\n// (Get Unscored Jobs = status 'scraped') never sends them to Gemini.\nconst SENIOR = /\\b(staff|principal|lead|director|vp|vice president|head|manager)\\b/i;\nconst SPAM = /(unpaid|commission only|mlm|pyramid)/i;\nconst AI_KW = [\"ai\",\"ml\",\"machine learning\",\"genai\",\"llm\",\"nlp\",\"computer vision\",\"data scientist\",\"mlops\",\"ai engineer\",\"research scientist\",\"deep learning\",\"generative\",\"foundation model\",\"data science\"];\nconst MIN_JD = 300;\nconst hasAI = t => { const l=(t||\"\").toLowerCase(); return AI_KW.some(k=>l.includes(k)); };\nreturn $input.all().map(item => {\n  const j = { ...item.json };\n  const title = j.role || \"\";\n  const jd = j.jd_text || \"\";\n  let reason = null;\n  if (SENIOR.test(title)) reason = \"senior-only title\";\n  else if (jd.length < MIN_JD) reason = \"thin description\";\n  else if (SPAM.test(jd) || SPAM.test(title)) reason = \"spam\";\n  else if (!hasAI(title) && !hasAI(jd)) reason = \"non-target (no AI/ML keywords)\";\n  if (reason) { j.status = \"filtered\"; j.match_justification = \"Filtered: \" + reason; }\n  return { json: j };\n});"
    }
  }
}
```

- [ ] **Step 2: Rewire connections**

Call `update_workflow` again with these operations (atomic batch):

```json
[
  { "type": "removeConnection", "source": "Filter Real Jobs", "target": "Insert One by One" },
  { "type": "addConnection", "source": "Filter Real Jobs", "target": "Quality Gate" },
  { "type": "addConnection", "source": "Quality Gate", "target": "Insert One by One" }
]
```

- [ ] **Step 3: Verify the wiring**

Call `mcp__n8n__get_workflow_details` with `workflowId: "ZZPsOF8vwttSIuZz"`.
Expected in `connections`: `Filter Real Jobs → Quality Gate` and `Quality Gate → Insert One by One`; no direct `Filter Real Jobs → Insert One by One`.

(No git commit — cloud workflow. A sanitized snapshot is refreshed in Task 6.)

---

## Task 3: WF01 — rubric prompt in "Prepare Gemini Request"

**Files:**
- Modify: WF01 node `Prepare Gemini Request` (via `setNodeParameter` on `/jsCode`)

- [ ] **Step 1: Replace the node's jsCode**

Call `mcp__n8n__update_workflow` (`workflowId: "ZZPsOF8vwttSIuZz"`) with:

```json
{
  "type": "setNodeParameter",
  "nodeName": "Prepare Gemini Request",
  "path": "/jsCode",
  "value": "const item = $input.first().json;\nconst CANDIDATE = \"Jagadeesh K L — AI/ML professional. B.Tech in Artificial Intelligence & Data Science (CGPA 8.6, 2024). 1.6+ years at Cognizant as a Workday Extend Consultant (custom enterprise apps, REST integrations, orchestrations, role-based security). Data Science Intern at Shiash Info Solutions. Skills: Python, SQL, TensorFlow, PyTorch, LangChain, ChainLit, Pandas, NumPy, Matplotlib, Power BI; Machine Learning, LLMs, NLP, LSTM, CNN, RAG, time-series forecasting, vector databases, REST APIs, data analytics. Projects: Med-Doc LLM medical chatbot (90% accuracy, RAG + vector DB + ChainLit); LSTM stock-price predictor (86% accuracy); LipNet + Morse Code accessibility tool (CNN, Android). Certifications: Generative AI — LLM Foundations (Google Cloud), Workday Pro Integrations, Workday Integration Orchestration, ML Specialization & Mathematics for ML (deeplearning.ai, ongoing). Locations: Chennai or Bangalore.\";\nconst prompt = \"Score this job against the candidate profile across 6 dimensions.\\n\\nCANDIDATE PROFILE:\\n\" + CANDIDATE + \"\\n\\nJOB (\" + item.company + \" — \" + item.role + \"):\\n\" + (item.jd_text||\"\").slice(0,1500) + \"\\n\\nReturn ONLY valid JSON (no markdown). Each dimension score is an integer 0-100 with a one-line reason:\\n{\\\"dimensions\\\":{\\\"stack_fit\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"},\\\"seniority\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"},\\\"location\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"},\\\"compensation\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"},\\\"evidence\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"},\\\"mission\\\":{\\\"score\\\":0,\\\"reason\\\":\\\"\\\"}},\\\"matched_skills\\\":[],\\\"missing_skills\\\":[]}\";\nreturn [{json:{\n  _job_id: item.id,\n  gemini_request:{\n    systemInstruction:{parts:[{text:\"You are an expert ATS resume analyst for AI/ML roles. Return valid JSON only, no markdown fences.\"}]},\n    contents:[{role:\"user\",parts:[{text:prompt}]}],\n    generationConfig:{temperature:0.1,maxOutputTokens:700,responseMimeType:\"application/json\"}\n  }\n}}];"
}
```

- [ ] **Step 2: Verify**

`get_workflow_details` → confirm `Prepare Gemini Request.parameters.jsCode` contains `"dimensions"` and `stack_fit`.

---

## Task 4: WF01 — weighted average + breakdown in "Parse Gemini Score"

**Files:**
- Modify: WF01 node `Parse Gemini Score` (via `setNodeParameter` on `/jsCode`)

- [ ] **Step 1: Replace the node's jsCode**

Call `update_workflow` (`workflowId: "ZZPsOF8vwttSIuZz"`) with:

```json
{
  "type": "setNodeParameter",
  "nodeName": "Parse Gemini Score",
  "path": "/jsCode",
  "value": "const resp = $input.first().json;\nconst text = (resp.candidates&&resp.candidates[0]&&resp.candidates[0].content&&resp.candidates[0].content.parts&&resp.candidates[0].content.parts[0]&&resp.candidates[0].content.parts[0].text)||'{}';\nconst clean = text.replace(/```json[\\s\\S]*?```|```[\\s\\S]*?```/g,'').replace(/```/g,'').trim();\nconst WEIGHTS = {stack_fit:0.30,evidence:0.20,seniority:0.20,mission:0.15,location:0.10,compensation:0.05};\nconst DIMS = [\"stack_fit\",\"seniority\",\"location\",\"compensation\",\"evidence\",\"mission\"];\nconst clamp = n => { n=Number(n); if(!isFinite(n)) return 0; return Math.max(0,Math.min(100,Math.round(n))); };\ntry {\n  const p = JSON.parse(clean);\n  const d = p.dimensions || {};\n  const breakdown = {};\n  let overall = 0;\n  for (const k of DIMS) {\n    const score = clamp(d[k] && d[k].score);\n    const reason = (d[k] && typeof d[k].reason === 'string') ? d[k].reason : '';\n    breakdown[k] = { score, reason };\n    overall += (WEIGHTS[k]||0) * score;\n  }\n  overall = Math.round(overall);\n  const matched = overall >= 60;\n  const justification = DIMS.map(k=>({k,r:breakdown[k].reason})).filter(x=>x.r).map(x=>x.k.replace('_',' ')+': '+x.r).join('\\n');\n  return [{json:{\n    match_score: overall,\n    score_breakdown: breakdown,\n    matched_skills: p.matched_skills||[],\n    missing_skills: p.missing_skills||[],\n    match_justification: matched ? justification : ('Below threshold ('+overall+')'),\n    status: matched ? 'matched' : 'filtered'\n  }}];\n} catch(e) {\n  return [{json:{match_score:0,score_breakdown:null,match_justification:'Parse failed',missing_skills:[],matched_skills:[],status:'scraped'}}];\n}"
}
```

(Note: on a genuine parse failure `status` stays `scraped` so the job is retried next run; only a successful low score becomes `filtered`.)

- [ ] **Step 2: Verify**

`get_workflow_details` → confirm `Parse Gemini Score.parameters.jsCode` contains `WEIGHTS` and `score_breakdown`.

---

## Task 5: WF01 — persist score_breakdown in "Save Match Score"

**Files:**
- Modify: WF01 node `Save Match Score` (via `setNodeParameter` on `/fieldsUi/fieldValues`)

- [ ] **Step 1: Replace the field values**

Call `update_workflow` (`workflowId: "ZZPsOF8vwttSIuZz"`) with:

```json
{
  "type": "setNodeParameter",
  "nodeName": "Save Match Score",
  "path": "/fieldsUi/fieldValues",
  "value": [
    { "fieldId": "match_score", "fieldValue": "={{ $json.match_score }}" },
    { "fieldId": "match_justification", "fieldValue": "={{ $json.match_justification }}" },
    { "fieldId": "missing_skills", "fieldValue": "={{ JSON.stringify($json.missing_skills) }}" },
    { "fieldId": "matched_skills", "fieldValue": "={{ JSON.stringify($json.matched_skills) }}" },
    { "fieldId": "score_breakdown", "fieldValue": "={{ JSON.stringify($json.score_breakdown) }}" },
    { "fieldId": "status", "fieldValue": "={{ $json.status }}" }
  ]
}
```

- [ ] **Step 2: Verify**

`get_workflow_details` → confirm `Save Match Score` field list includes `score_breakdown`.

---

## Task 6: WF01 — publish + smoke test

**Files:** none (cloud + optional snapshot)

- [ ] **Step 1: Publish the workflow**

Call `mcp__n8n__publish_workflow` with `workflowId: "ZZPsOF8vwttSIuZz"`. (Migration 002 from Task 1 MUST be applied first, or inserts with `status='filtered'` fail.)

- [ ] **Step 2: Run a test execution**

Call `mcp__n8n__execute_workflow` with `workflowId: "ZZPsOF8vwttSIuZz"` (or trigger the schedule manually in the n8n UI). Wait for completion.

- [ ] **Step 3: Verify results in Supabase**

In the Supabase SQL editor:

```sql
-- a) rubric stored on a scored job
SELECT company, role, match_score, score_breakdown
FROM applications
WHERE score_breakdown IS NOT NULL
ORDER BY updated_at DESC LIMIT 3;
-- expect: score_breakdown has 6 keys each with {score, reason}; match_score = weighted avg

-- b) gate marked some jobs filtered (no breakdown, "Filtered:" reason)
SELECT count(*) FROM applications
WHERE status='filtered' AND match_justification LIKE 'Filtered:%';

-- c) low-score jobs filtered with a breakdown
SELECT count(*) FROM applications
WHERE status='filtered' AND match_justification LIKE 'Below threshold%';
```
Expected: (a) returns rows with full 6-key breakdowns; (b) ≥0 (likely >0 if any senior/thin titles scraped); (c) ≥0.

- [ ] **Step 4: Refresh the sanitized snapshot (if present) and commit**

If `n8n-workflows/cloud/01-*.json` exists, export the updated WF01 (redact tokens) into it and commit:

```bash
git add n8n-workflows/cloud/
git commit -m "chore(wf01): snapshot rubric + quality-gate workflow"
```
If no snapshot file exists, skip this step.

---

## Task 7: Dashboard API — hide `filtered`, count it

**Files:**
- Modify: `dashboard/app/api/applications/route.ts`
- Modify: `dashboard/app/api/counts/route.ts`

- [ ] **Step 1: Hide `filtered` in the default list**

In `dashboard/app/api/applications/route.ts`, change the default-hide line:

```ts
  // Filter in JS so we don't reference enum values in SQL.
  let apps = data ?? [];
  if (!status || status === 'all') {
    apps = apps.filter((a: any) => a.status !== 'dismissed' && a.status !== 'filtered');
  }
  if (starred === 'true') apps = apps.filter((a: any) => a.starred === true);
```

(Explicitly requesting `?status=filtered` still returns them — the SQL `.eq('status','filtered')` path is untouched.)

- [ ] **Step 2: Add a `filtered` count**

In `dashboard/app/api/counts/route.ts`, extend the parallel counts:

```ts
  const [review, manual, interviews, saved, filtered] = await Promise.all([
    countOf(q => q.eq('status', 'matched')),
    countOf(q => q.eq('is_manual_required', true).in('status', ['matched', 'approved'])),
    countOf(q => q.in('status', ['interview_scheduled', 'assessment', 'offer'])),
    countOf(q => q.eq('starred', true)),
    countOf(q => q.eq('status', 'filtered')),
  ]);

  return NextResponse.json({ review, manual, interviews, saved, filtered });
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && ../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Verify against the running server**

With the dev server running (start per CLAUDE.md only if asked), run:

```powershell
(Invoke-WebRequest "http://127.0.0.1:3000/api/counts" -UseBasicParsing).Content
# expect JSON now includes "filtered": <n>
(Invoke-WebRequest "http://127.0.0.1:3000/api/applications?status=filtered" -UseBasicParsing).Content | ConvertFrom-Json | % { $_.applications.Count }
# expect: count >= 0 (filtered rows returned when explicitly requested)
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/applications/route.ts dashboard/app/api/counts/route.ts
git commit -m "feat(api): hide filtered jobs by default, add filtered count"
```

---

## Task 8: Dashboard — shared score helper

**Files:**
- Create: `dashboard/lib/score.ts`

- [ ] **Step 1: Create the helper**

```ts
// Shared rubric metadata for rendering the score breakdown.
export interface Dimension { score: number; reason: string }
export type ScoreBreakdown = Record<string, Dimension>;

export const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'stack_fit', label: 'Stack fit' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'location', label: 'Location' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'mission', label: 'Mission' },
];

/** Tailwind bg class for a 0-100 score. */
export function scoreColor(score: number): string {
  if (score >= 75) return 'bg-success';
  if (score >= 50) return 'bg-primary';
  return 'bg-danger';
}
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && ../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/score.ts
git commit -m "feat(dashboard): shared rubric dimension/score helper"
```

---

## Task 9: Dashboard — render the breakdown in the Review card

**Files:**
- Modify: `dashboard/app/review/page.tsx`

- [ ] **Step 1: Extend the ReviewJob interface and import the helper**

At the top of `dashboard/app/review/page.tsx`, add the import:

```ts
import { DIMENSIONS, scoreColor, type ScoreBreakdown } from '../../lib/score';
```

In the `ReviewJob` interface, add the field:

```ts
  score_breakdown?: ScoreBreakdown | null;
```

- [ ] **Step 2: Add the breakdown block to the card**

In the card body, immediately BEFORE the `{/* Why */}` block, insert:

```tsx
              {/* Score breakdown */}
              {current.score_breakdown && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Score breakdown
                  </p>
                  <div className="space-y-2">
                    {DIMENSIONS.map(({ key, label }) => {
                      const dim = current.score_breakdown?.[key];
                      if (!dim) return null;
                      return (
                        <div key={key} className="grid grid-cols-[110px_64px_1fr] items-center gap-3">
                          <span className="text-xs font-medium text-foreground">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-9 overflow-hidden rounded-full bg-muted">
                              <span className={cn('block h-full rounded-full', scoreColor(dim.score))} style={{ width: `${dim.score}%` }} />
                            </span>
                            <span className="nums text-xs font-semibold text-foreground">{dim.score}</span>
                          </div>
                          <span className="truncate text-xs text-muted-foreground" title={dim.reason}>{dim.reason}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
```

(Older jobs with no `score_breakdown` skip this block and still show the existing "Why it matched" text.)

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && ../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Verify in the browser**

With the dev server running, open `http://localhost:3000/review`. Expected: a matched job shows a "Score breakdown" block with 6 labelled bars + scores + reasons. (If the queue is empty, temporarily restore a filtered job via Task 10's Restore button, or `PATCH` one to `status='matched'`.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/review/page.tsx
git commit -m "feat(review): show 6-dimension score breakdown on the card"
```

---

## Task 10: Dashboard — Filtered/Low-score view + Restore

**Files:**
- Create: `dashboard/app/filtered/page.tsx`
- Modify: `dashboard/components/app-sidebar.tsx`

- [ ] **Step 1: Create the Filtered page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Filter as FilterIcon } from 'lucide-react';
import { MatchBadge } from '../../components/MatchBadge';

interface FilteredJob {
  id: string;
  company: string;
  role: string;
  jd_url: string;
  match_score: number | null;
  match_justification: string | null;
  score_breakdown: Record<string, { score: number; reason: string }> | null;
  created_at: string;
}

export default function FilteredPage() {
  const [jobs, setJobs] = useState<FilteredJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/applications?status=filtered')
      .then(r => r.json())
      .then(d => {
        const list: FilteredJob[] = d.applications ?? [];
        // Highest score first so near-misses (55-59) surface above gate-rejected (no score).
        list.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        setJobs(list);
      })
      .finally(() => setLoading(false));
  }, []);

  async function restore(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id));
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched' }),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Filtered / Low-score</h1>
        <p className="text-sm text-muted-foreground">Jobs the gate skipped or that scored under 60. Nothing is deleted — restore any to Review.</p>
      </div>

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><FilterIcon className="h-7 w-7" /></span>
          <p className="font-display text-lg font-semibold text-foreground">Nothing filtered</p>
          <p className="max-w-sm text-sm text-muted-foreground">Gate-rejected and sub-60 jobs will appear here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Company', 'Role', 'Score', 'Reason', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <a href={j.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                        {j.company}<ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{j.role}</td>
                    <td className="px-4 py-3">{j.score_breakdown ? <MatchBadge score={j.match_score} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-xs text-muted-foreground" title={j.match_justification ?? ''}>{j.match_justification ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => restore(j.id)} className="pill bg-primary/10 text-primary transition-colors hover:bg-primary/20">Restore to Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the sidebar nav item**

In `dashboard/components/app-sidebar.tsx`:

Add `Filter` to the lucide import:
```ts
  CalendarCheck, BarChart3, Settings, Sparkles, Star, Filter,
```

Add to `BadgeKey`:
```ts
type BadgeKey = 'review' | 'manual' | 'interviews' | 'saved' | 'filtered';
```

Add the nav entry after Analytics:
```ts
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/filtered', label: 'Filtered', icon: Filter, badge: 'filtered' },
```

Extend the counts state default:
```ts
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ review: 0, manual: 0, interviews: 0, saved: 0, filtered: 0 });
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && ../node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:3000/filtered`. Expected: a "Filtered" sidebar item with a count; the page lists filtered jobs sorted by score; "Restore to Review" removes a row and (verify) the job reappears in `/review`.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/filtered/page.tsx dashboard/components/app-sidebar.tsx
git commit -m "feat(dashboard): Filtered/Low-score view with Restore-to-Review"
```

---

## Task 11 (secondary): Repo agents parity

These keep the non-deployed Docker-reference matcher consistent with the cloud. Lower priority; do only if maintaining the agent path.

**Files:**
- Create: `agents/scraper/quality-gate.ts`
- Modify: `agents/matcher/prompts.ts`
- Modify: `agents/matcher/index.ts`

- [ ] **Step 1: Create the shared gate helper**

```ts
// agents/scraper/quality-gate.ts
const SENIOR = /\b(staff|principal|lead|director|vp|vice president|head|manager)\b/i;
const SPAM = /(unpaid|commission only|mlm|pyramid)/i;
const AI_KW = ['ai','ml','machine learning','genai','llm','nlp','computer vision','data scientist','mlops','ai engineer','research scientist','deep learning','generative','foundation model','data science'];
const MIN_JD = 300;
const hasAI = (t: string) => { const l = (t || '').toLowerCase(); return AI_KW.some(k => l.includes(k)); };

/** Returns a filter reason string if the job should be gated, else null. */
export function gateReason(role: string, jdText: string): string | null {
  if (SENIOR.test(role || '')) return 'senior-only title';
  if ((jdText || '').length < MIN_JD) return 'thin description';
  if (SPAM.test(jdText || '') || SPAM.test(role || '')) return 'spam';
  if (!hasAI(role || '') && !hasAI(jdText || '')) return 'non-target (no AI/ML keywords)';
  return null;
}
```

- [ ] **Step 2: Update the matching prompt**

Replace `agents/matcher/prompts.ts` `buildMatchingPrompt` body so it requests the rubric:

```ts
export function buildMatchingPrompt(resumeJson: object, jdText: string): string {
  return `Score this candidate against the job across 6 dimensions.

CANDIDATE PROFILE:
${JSON.stringify(resumeJson, null, 2)}

JOB DESCRIPTION:
${jdText}

Return ONLY valid JSON (no markdown). Each dimension score is an integer 0-100 with a one-line reason:
{
  "dimensions": {
    "stack_fit":    {"score": 0, "reason": ""},
    "seniority":    {"score": 0, "reason": ""},
    "location":     {"score": 0, "reason": ""},
    "compensation": {"score": 0, "reason": ""},
    "evidence":     {"score": 0, "reason": ""},
    "mission":      {"score": 0, "reason": ""}
  },
  "matched_skills": [],
  "missing_skills": []
}`;
}

export const MATCHING_SYSTEM_PROMPT =
  'You are an expert ATS resume analyst and technical recruiter specialising in AI/ML roles.';
```

- [ ] **Step 3: Update the matcher to compute the weighted average + gate**

In `agents/matcher/index.ts`, replace the `MatchResult` interface and `matchJob` parsing, and gate before scoring. Add near the top:

```ts
import { gateReason } from '../scraper/quality-gate';

const WEIGHTS: Record<string, number> = { stack_fit: 0.30, evidence: 0.20, seniority: 0.20, mission: 0.15, location: 0.10, compensation: 0.05 };
const DIMS = ['stack_fit', 'seniority', 'location', 'compensation', 'evidence', 'mission'];
const clamp = (n: any) => { n = Number(n); return isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };
```

Replace `matchJob` so it returns the breakdown + overall:

```ts
interface MatchResult {
  match_score: number;
  score_breakdown: Record<string, { score: number; reason: string }>;
  matched_skills: string[];
  missing_skills: string[];
  match_justification: string;
  status: 'matched' | 'filtered';
}

async function matchJob(jdText: string): Promise<MatchResult | null> {
  try {
    const prompt = buildMatchingPrompt(baseResume, jdText);
    const text = await generateWithRetry(prompt, { tag: 'matcher' });
    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const p = JSON.parse(json);
    const d = p.dimensions || {};
    const breakdown: Record<string, { score: number; reason: string }> = {};
    let overall = 0;
    for (const k of DIMS) {
      const score = clamp(d[k] && d[k].score);
      breakdown[k] = { score, reason: (d[k] && typeof d[k].reason === 'string') ? d[k].reason : '' };
      overall += (WEIGHTS[k] || 0) * score;
    }
    overall = Math.round(overall);
    const matched = overall >= 60;
    const justification = DIMS.map(k => ({ k, r: breakdown[k].reason })).filter(x => x.r).map(x => `${x.k.replace('_', ' ')}: ${x.r}`).join('\n');
    return {
      match_score: overall,
      score_breakdown: breakdown,
      matched_skills: p.matched_skills || [],
      missing_skills: p.missing_skills || [],
      match_justification: matched ? justification : `Below threshold (${overall})`,
      status: matched ? 'matched' : 'filtered',
    };
  } catch (err: any) {
    console.error('[matcher] Gemini error:', err?.message || err);
    return null;
  }
}
```

In `main()`, gate each job before scoring (after the `if (!job.jd_text)` guard):

```ts
    const reason = gateReason(job.role, job.jd_text);
    if (reason) {
      await supabase.from('applications').update({ status: 'filtered', match_justification: `Filtered: ${reason}` }).eq('id', job.id);
      console.log(`[matcher] gated ${job.company}: ${reason}`);
      continue;
    }
```

And extend the success update to write the new fields:

```ts
      .update({
        match_score: result.match_score,
        score_breakdown: result.score_breakdown,
        matched_skills: result.matched_skills,
        missing_skills: result.missing_skills,
        match_justification: result.match_justification,
        status: result.status,
      })
```

- [ ] **Step 4: Typecheck the agents**

Run: `cd "C:/Users/jagadeesh/OneDrive/Documents/Job Hunt/job-agent" && node_modules/.bin/tsc --noEmit -p tsconfig.json` (or the agents tsconfig if separate).
Expected: exit 0 (no type errors in the modified files).

- [ ] **Step 5: Commit**

```bash
git add agents/scraper/quality-gate.ts agents/matcher/prompts.ts agents/matcher/index.ts
git commit -m "feat(agents): rubric scoring + quality gate parity with cloud"
```

---

## Final verification checklist

- [ ] Migration 002 applied; `score_breakdown` column + `filtered` enum value exist (Task 1 Step 3).
- [ ] WF01 wiring: `Filter Real Jobs → Quality Gate → Insert One by One` (Task 2 Step 3).
- [ ] A WF01 run produces jobs with 6-key `score_breakdown` and `match_score` = weighted average (Task 6 Step 3a).
- [ ] Senior/thin/spam jobs are `status='filtered'` with `Filtered:` reason and were NOT scored (Task 6 Step 3b).
- [ ] Sub-60 jobs are `status='filtered'` with `Below threshold (NN)` and have a breakdown (Task 6 Step 3c).
- [ ] Review card shows the breakdown; old rows fall back to "Why" (Task 9 Step 4).
- [ ] Filtered jobs hidden from default Applications/Review; visible on `/filtered`; Restore works (Task 10 Step 4).
- [ ] `tsc --noEmit` passes for the dashboard (Tasks 7-10).
- [ ] No increase in Gemini requests per run (gate + no-re-score reduce volume).
