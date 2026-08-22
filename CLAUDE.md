# CLAUDE.md — Job Agent Project Context

## What this project does
Autonomous job application system. Scrapes AI/ML jobs, scores them, generates tailored resumes/cover letters, auto-applies, monitors email for responses, sends Telegram alerts, syncs to Notion.

## Tech Stack
- Frontend: Next.js 15, Tailwind CSS, Shadcn UI → deployed on **Render**
  (free web service; needs a container host because doc generation runs headless
  Chromium — Vercel serverless couldn't provide the shared libs). Live URL:
  https://job-hunt-dashboard-0885.onrender.com (service srv-d8ng000k1i2s73dajttg).
- Database: Supabase (PostgreSQL) free tier
- Orchestration: **GitHub Actions** (`.github/workflows/`). The old n8n Cloud
  workspace expired (~2026-06), so the daily pipeline was rebuilt as free
  scheduled Actions. n8n (Cloud and the repo's Docker compose) is RETIRED.
- AI: Google Gemini API, free tier. Primary model `gemini-2.5-flash-lite` with a
  5-model fallback chain (see agents/lib/gemini.ts) — each model name is a
  separate free daily quota bucket, giving ~80-100 free scores/day with no billing.
- Job Discovery: Apify Google Search Scraper (free tier, ~$0.03/run of $5 credit)
  — discovers ATS board slugs, then JD text is pulled from public ATS APIs.
- Indeed (paid, separate cadence): Apify `misceres/indeed-scraper` (~$0.006/listing).
  Returns fully structured jobs WITH description text directly — no ATS API.
  NOT part of the daily run; runs Mon & Thu via Workflow 05. Backlog-aware and
  capped per run (MAX_PER_RUN) to keep Apify spend predictable.
- Job Data: Greenhouse, Lever, and Ashby public APIs (no auth needed)
- Email: Gmail API with OAuth2
- Alerts: Telegram Bot API (free)
- Notion: Notion API (free)
- PDF: dashboard renders the locked HTML templates to PDF via **headless
  Chromium** on Render (`dashboard/lib/render-pdf.ts`), uploaded to Supabase
  Storage. Uses the full **`puppeteer`** package with its OWN bundled,
  version-matched Chromium — NOT `puppeteer-core` + apt `chromium` (Debian
  floats that to bleeding-edge builds puppeteer can't launch; caused a
  "Failed to launch the browser process" outage fixed 2026-07-09). Dockerfile
  installs only Chromium's shared libs + fonts. (pdf-lib / Edge `--print-to-pdf`
  retired.) Every rendered PDF passes through `stripPdfMetadata()` in the same
  file before it is returned: Chromium stamps `/Creator` with its full
  "…HeadlessChrome/149…" UA and `/Producer` with "Skia/PDF m149", which tells a
  recruiter reading file properties that the document was machine-generated.
  Both values are overwritten with spaces **in place** — never resized, so byte
  offsets and the xref table stay valid. `/Title` is kept. Note the values are
  PDF literal strings with ESCAPED parens (`\(Windows NT 10.0…\)`), so the
  stripper walks them with a depth+escape scanner; a plain `\(([^)]*)\)` regex
  silently leaves `HeadlessChrome` in the file.

## How agents run
The daily pipeline runs the TypeScript agents directly on a **GitHub Actions
runner** — `.github/workflows/daily-pipeline.yml` does `npm install` then
`npx ts-node agents/matcher/index.ts` (match backlog first) followed by
`npx ts-node agents/scraper/daily-scrape.ts` (top-up scrape). Secrets come from
GitHub Actions repository secrets (GOOGLE_API_KEY, APIFY_API_TOKEN, SUPABASE_URL,
SUPABASE_SERVICE_KEY), NOT `.env.local`. (Locally the same agents still read
`.env.local`.) The repo's `scripts/agent-server.js` + Docker n8n design is
reference-only and NOT deployed.

## Environment Variables needed (.env.local — never committed)
GOOGLE_API_KEY=            # Gemini, all AI tasks
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
APIFY_API_TOKEN=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
TELEGRAM_BOT_TOKEN=        # also needed by the n8n container (docker/.env)
TELEGRAM_CHAT_ID=          # also needed by the n8n container (docker/.env)
NOTION_API_KEY=
NOTION_DATABASE_ID=
N8N_WEBHOOK_URL=
N8N_BASE_URL=
N8N_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
(ANTHROPIC_API_KEY is no longer used — all AI runs on Gemini.)

## Key Rules
- AI is Google Gemini (not Claude). All Gemini calls go through
  `generateWithRetry()` in agents/lib/gemini.ts: 503 backoff, instant skip of
  daily-exhausted models, fallback across 5 models.
- Never use Playwright on LinkedIn or Indeed (gets banned). Indeed is scraped
  ONLY via the Apify `misceres/indeed-scraper` actor, never directly.
- Use Apify for Google Search discovery (fetch JD text from public ATS APIs)
  and for the Indeed top-up (JD text comes directly in the actor output).
- Indeed jobs cannot be auto-applied (no ATS API) → stored as ats_type='custom'
  with is_manual_required=true, so they land in the manual-apply queue.
- Gemini is used for: job matching, resume tailoring, cover letter, email
  classification, interview question generation
- Scraping is FREE (ATS + Apify); only matching/resume-gen cost Gemini quota.
  The matcher is the bottleneck, so daily-scrape is backlog-aware.
- All PDFs generated with pdf-lib, uploaded to Supabase Storage
- Daily cron runs at 08:00 IST (02:30 UTC) — shortly after the Gemini quota
  resets (midnight US Pacific), so each run starts with a near-full budget.
- Daily order: MATCH backlog first (oldest jobs first), THEN top-up scrape.
- Max 15 auto-applies per day to avoid spam flagging
- Always deduplicate by jd_url; matcher only touches status='scraped' so no job
  is scraped or scored twice.
- Resume generation: always present exactly 2 years of experience regardless of
  the JD's ask; ATS-optimise (mirror JD keywords, standard headings, no tables).
- The resume template is **single-column** (`dashboard/lib/resume-template.ts`).
  Do NOT reintroduce a sidebar. An ATS reads the PDF's text layer, and a
  two-column body linearises the ENTIRE sidebar before the right-hand content —
  measured on the real resume, Experience sat at line 45 of the extracted text
  and moving to one column brought it to line 12 (ATS parseability 82 → 96).
  Section order is Summary → Skills → Experience → Projects → Education +
  Certifications. Skills are comma-separated text, not flex chips: chips wrap
  onto their own lines and orphan single keywords ("Power BI" alone on a line).
  Never put an emoji in a template — Chromium writes it as an unpaired surrogate
  pair, which is invalid UTF-8 and shows as U+FFFD to a parser.
- Manual apply queue for non-Greenhouse/Lever companies (Workday, custom portals)

## Application Status Pipeline
scraped → matched → approved → applied → interview_scheduled → assessment → rejected → offer
- `filtered` — set by WF01 Quality Gate (senior-title / **>5y experience** / thin /
  off-target) OR by a rubric score `<60`. Never (re)scored; hidden from default
  views; browsable on the dashboard **Excluded** page (Restore / Remove).
- `dismissed` — Review "Reject", Excluded "Remove", or Applications "Remove".

DB note: `database/schema.sql` is kept in sync with production — it includes the
`dismissed`/`filtered` enum values, the `starred` + `score_breakdown` columns, and
`status` is `NOT NULL DEFAULT 'scraped'`. Incremental changes for already-deployed
DBs live in `database/migrations/` (001 review queue, 002 rubric+filtered, 003
status NOT NULL — all applied to prod). The applications API references the
`dismissed`/`filtered` labels in SQL, so those enum values MUST exist before it runs.

## Current dashboard flow (live — human-in-the-loop, manual apply)
1. Daily pipeline (**GitHub Actions**, `.github/workflows/daily-pipeline.yml`,
   cron `30 2 * * 1,3,5` = **Mon/Wed/Fri 08:00 IST**): runs `agents/matcher`
   FIRST (score the unscored backlog oldest-first) then `agents/scraper/
   daily-scrape` (top-up to backlog target 60). Matcher = **Quality Gate**
   (`agents/scraper/quality-gate.ts`: drop senior/>5y/thin/off-target to
   `filtered`) → Gemini **6-dimension rubric** (stack/seniority/location/comp/
   evidence/mission, 0–100 each) → `match_score` = weighted average
   (.30/.20/.20/.15/.10/.05) → ≥60 `matched`, <60 `filtered`. Stored in JSONB
   `score_breakdown` column + the `filtered` enum value.
2. Dashboard is **login-gated** (`/login`, cookie auth; creds in dashboard/.env.local:
   DASHBOARD_EMAIL/PASSWORD + AUTH_TOKEN).
3. **Applications** page (full filterable list, hides applied+ by default) → matched
   job → **Generate docs** (`/api/approve`: Gemini-tailored resume+cover in the
   locked blue/white template, HTML→PDF via **headless Chromium on Render**,
   uploaded to Supabase Storage) → `approved`. Each row has two columns: **Links** (Resume/Cover/Apply/
   View JD anchors) and **Actions** (Generate docs/Mark applied/Revert/**Remove**).
   **Remove** sets `dismissed` (same as Excluded→Remove). Shared component:
   `components/ApplicationTable.tsx` (used by Applications + Dashboard); pill
   buttons come from `components/PillButton.tsx`.
4. **Mark applied** (after applying manually) → `applied`, moves to **Dashboard**.
5. **Dashboard** (`/`) = applied jobs only (Company/Role/Date/JD link/Status) +
   stats/charts/activity; **Revert** sends one back to Applications. NOTE: the
   list API (`/api/applications`) excludes `dismissed`/`filtered` **in SQL before**
   its 200-row cap, so applied/matched jobs are never dropped by filtered noise.
6. **Excluded** (`/filtered`), **Saved** (`/saved`) + notifications bell, Review
   queue (Approve/Skip/Reject/Save). base-resume.json is the single source of truth
   for BOTH the matcher profile and the generated documents.

## Agent Locations
- Scraper (static list): agents/scraper/index.ts
- Discovery (Apify Google → DB): agents/scraper/discover.ts
- Indeed scrape (Apify misceres → DB, manual queue): agents/scraper/indeed-search.ts
- Daily backlog-aware scrape (list + Apify Google, free only): agents/scraper/daily-scrape.ts
- Shared scrape/store helpers: agents/scraper/store.ts
- Matcher: agents/matcher/
- Shared Gemini retry/fallback helper: agents/lib/gemini.ts
- Resume Gen: agents/resume-generator/
- Auto Apply: agents/auto-apply/
- Email Monitor: agents/email-monitor/
- Telegram: agents/telegram-bot/
- Notion Sync: agents/notion-sync/

## Orchestration — GitHub Actions (LIVE) — replaced n8n
Two free scheduled Actions in `.github/workflows/`:
- **`daily-pipeline.yml`** — the daily scrape+match. Cron `30 2 * * 1,3,5`
  (08:00 IST Mon/Wed/Fri). Runs `agents/matcher` then `agents/scraper/
  daily-scrape` on an ubuntu runner. `workflow_dispatch` allows manual runs from
  the Actions tab. Reads GOOGLE_API_KEY / APIFY_API_TOKEN / SUPABASE_URL /
  SUPABASE_SERVICE_KEY from **repo Actions secrets** (Settings → Secrets and
  variables → Actions). Has a preflight step that fails loudly if a secret is
  missing. Match-first order means newly scraped jobs are scored on the NEXT run.
- **`supabase-keepalive.yml`** — pings the Supabase public REST endpoint every
  2 days (`17 6 */2 * *`) with the PUBLIC anon key so the free-tier DB never
  auto-pauses (it pauses after 7 days of no queries). Anon key is safe to commit;
  no secret key is used here.

Public repo ⇒ unlimited free Actions minutes. Edge case: GitHub disables
scheduled Actions after 60 days of ZERO repo activity — a stray commit resets it.

### Retired: n8n
The old live orchestration was **n8n Cloud** (jagadeeshkl.app.n8n.cloud, WF01 +
WF05). That workspace/trial EXPIRED (~2026-06), which is what silently stopped
the daily runs (no new jobs 2026-06-14 → 2026-07-08) and let Supabase pause.
The repo's `n8n-workflows/*.json` + `scripts/agent-server.js` (Docker design)
and `n8n-workflows/cloud/*.json` (sanitized cloud snapshots) are now historical
reference only — nothing runs on n8n anymore. **Indeed top-up (old WF05) is NOT
yet ported** to Actions (it's paid Apify credit; add a separate workflow if the
user wants it back). Correctness rules still baked into the TS agents: Supabase
inserts use ignore-duplicate upsert on jd_url (one dup can't fail the batch).
