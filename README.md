# Job Agent

Autonomous job application system. Scrapes AI/ML job listings from Greenhouse, Lever, and Ashby ATS APIs, scores them against your resume, generates tailored resumes and cover letters, and tracks every application through a dashboard.

> **Live deployment note:** the diagram and Docker/agent instructions further down
> are the self-hostable **reference** design. The system actually runs on
> **GitHub Actions (daily cron) + Supabase + a Next.js dashboard on Render**, and
> is **human-in-the-loop / manual-apply**. n8n is **retired** (the old n8n Cloud
> trial expired ~2026-06). The current end-to-end flow is below.

## Current flow (live)

1. **Scrape + score** (**GitHub Actions** `.github/workflows/daily-pipeline.yml`, cron **Mon/Wed/Fri 08:00 IST**): scrape Greenhouse/Lever/
   Ashby + Apify Google discovery → **Quality Gate** drops senior-title,
   **>5-years-experience**, thin, and off-target jobs (`status='filtered'`, never
   sent to Gemini) → Gemini scores survivors on a **6-dimension rubric**
   (Stack · Seniority · Location · Compensation · Evidence · Mission, 0–100 each
   with reasons) → `match_score` = weighted average (Stack .30 / Evidence .20 /
   Seniority .20 / Mission .15 / Location .10 / Comp .05) → **≥60 = matched**,
   **<60 = filtered** (scored once). Telegram summary.
2. **Login** (`/login`) gates the dashboard (single-user cookie auth).
3. **Review** (`/review`) / **Applications** (`/applications`): for a **matched**
   job → **Generate docs** → Gemini tailors a resume + cover letter (locked
   blue/white template → PDF → Supabase Storage) → status **approved**. The Review
   card shows the 6-dimension breakdown bars. The Applications table splits each
   row into a **Links** column (Resume/Cover/Apply/View JD) and an **Actions**
   column (Generate docs/Mark applied/Revert/**Remove**); **Remove** dismisses a
   job you don't want.
4. **Apply manually** (open the JD) → **Mark applied** → status **applied**; the
   job moves to the **Dashboard** and leaves Applications.
5. **Dashboard** (`/`) = your **applied** jobs (Company · Role · Date · JD link ·
   Status) + stats / charts / activity. **Revert** sends an applied job back to
   Applications.
6. **Excluded** (`/filtered`) = gate-rejected + sub-60 jobs, sorted by score, each
   with **Restore** (→ Review) or **Remove** (dismiss). Nothing is deleted —
   everything is recoverable.
7. **Saved** (`/saved`) + the notifications bell = jobs you star in Review.

Resume/cover generation runs in the **dashboard** (`/api/approve`) because it
renders HTML→PDF via **headless Chromium (puppeteer-core)** — which is why the
dashboard is hosted on **Render** (a container host) rather than Vercel
serverless. The daily scrape+match runs on **GitHub Actions**
(`.github/workflows/daily-pipeline.yml`) — the repo's `n8n-workflows/*` and
Docker files are historical reference, not what's deployed.

## Architecture (Docker reference — self-host)

```
Curated company list  +  Apify Google-search discovery
        │
        ▼
 [daily-scrape] ──► Greenhouse / Lever / Ashby APIs ──► Supabase (status: scraped)
        │            (backlog-aware: only tops up to a target)
        ▼
   [matcher] ──► Gemini scores 0–100, oldest first (status: matched)
        │
        ▼
  Telegram bot ──► manual approve/reject (or dashboard)
        │
        ▼
 [resume-generator] ──► Gemini generates 2-yr ATS resume + cover letter PDF
        │                 uploaded to Supabase Storage
        ▼
  [auto-apply] ──► submits via Greenhouse / Lever API (status: applied)
        │
        ▼
 [email-monitor] ──► Gmail OAuth2, classifies replies
        │
        ▼
  [notion-sync] ──► syncs status, interview prep, skill gaps to Notion
```

**How it runs:** agents are TypeScript scripts executed on the host by
`scripts/agent-server.js` (HTTP server on port 3002). n8n runs in Docker and
triggers them via `http://host.docker.internal:3002/run/<agent>`. The daily cron
fires at **08:00 UTC (1:30 PM IST)** — just after the Gemini free quota resets —
and runs **match-first, then top-up scrape**. n8n also hosts the Telegram
approval webhook.

**AI / quota:** all AI is Google Gemini (free tier). Calls go through a
5-model fallback chain (`agents/lib/gemini.ts`); since each model has its own
~20/day bucket, the effective free budget is ~80–100 scores/day. Scraping is
free — only matching and resume generation consume Gemini quota — so scraping is
backlog-aware to avoid stockpiling jobs that can't be scored.

## Setup

### 1. Install dependencies

```bash
bash scripts/setup.sh
```

Creates `.env.local` from `.env.example` if it doesn't exist, installs agent + dashboard deps via pnpm.

### 2. Fill in `.env.local`

Key setup order (free tiers first):

| Key | Where to get it |
|-----|----------------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API |
| `GOOGLE_API_KEY` | Google AI Studio → Create API key (all AI tasks; no Anthropic key needed) |
| `APIFY_API_TOKEN` | apify.com → Settings → Integrations |
| `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` | GCP Console → OAuth2, then run the auth script |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | @BotFather → new bot; chat ID from @userinfobot |
| `NOTION_API_KEY` / `NOTION_DATABASE_ID` | Notion → Settings → Integrations |
| `N8N_WEBHOOK_URL` / `N8N_BASE_URL` / `N8N_API_KEY` | n8n instance settings |

### 3. Set up Supabase

Paste `database/schema.sql` into the Supabase SQL editor and run it. Optionally run `database/seed.sql` for test data.

### 4. Start n8n (Docker)

The n8n container needs your Telegram credentials for the workflow Telegram
nodes. Copy the template and fill it in (this file is gitignored):

```bash
cp docker/.env.example docker/.env   # then add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
docker compose -f docker/docker-compose.yml up -d
```

Then import workflows (set `N8N_API_KEY` in `.env.local` first, from
n8n → Settings → API):

```bash
bash scripts/import-n8n-workflows.sh
```

### 5. Start the agent server (host)

n8n calls agents on the host. Keep this running in its own terminal:

```bash
node scripts/agent-server.js   # listens on :3002
```

### 6. Smoke test & dashboard

```bash
bash scripts/test-all-agents.sh
cd dashboard && npm install && npm run dev   # http://localhost:3000
```

> The dashboard has its own deps — run `npm install` in `dashboard/` once
> (`pnpm` works too if installed). On Windows, launch from a shell that has
> Node on PATH (PowerShell), not Git-Bash.

## Running Agents Manually

Trigger via the agent server (matches what n8n does):

```bash
curl -X POST http://localhost:3002/run/daily-scrape   # backlog-aware scrape (list + Apify)
curl -X POST http://localhost:3002/run/matcher        # score scraped jobs (oldest first)
curl -X POST http://localhost:3002/run/discover       # Apify discovery → DB
curl -X POST http://localhost:3002/run/email-monitor  # Gmail → classify → update
curl -X POST "http://localhost:3002/run/resume-generator?id=<uuid>"
curl -X POST "http://localhost:3002/run/auto-apply?id=<uuid>"
```

Or run a script directly: `npx ts-node agents/matcher/index.ts`.

## Application Status Pipeline

```
scraped → matched → approved → applied → interview_scheduled → assessment → rejected / offer
                 ↘ filtered (quality gate or score <60)        ↘ dismissed (rejected/removed)
```

| Status | Set by (live) |
|--------|--------|
| `scraped` | WF01 scrape on insert |
| `filtered` | WF01 Quality Gate (senior / >5y / thin / off-target) **or** score `<60`; hidden, shown on **Excluded** |
| `matched` | WF01 matcher, `match_score ≥ 60` (with 6-dim `score_breakdown`) |
| `approved` | dashboard **Generate docs** (resume + cover generated) |
| `applied` | dashboard **Mark applied** (you applied manually) |
| `interview_scheduled` / `assessment` / `rejected` / `offer` | email-monitor (or manual on the Interviews board) |
| `dismissed` | Review **Reject**, Excluded **Remove**, or Applications **Remove** |

`status` is `NOT NULL DEFAULT 'scraped'`. The schema (`database/schema.sql`) is kept in sync with production (enum includes `dismissed`/`filtered`; `starred` + `score_breakdown` columns present); incremental migrations for deployed DBs live in `database/migrations/` (001–003). The dashboard list API excludes `dismissed`/`filtered` in SQL before its 200-row cap, so applied/matched jobs are never crowded out by filtered rows.

`match_score` is the weighted average of the 6 rubric dimensions, stored alongside the JSONB `score_breakdown` column. Jobs with `is_manual_required = true` (Workday, custom portals) are applied externally, then marked applied.

## Key File Locations

```
agents/
  lib/gemini.ts     — shared Gemini call with retry + 5-model fallback
  scraper/
    index.ts        — scrape the curated company list
    discover.ts     — Apify discovery → fetch → DB
    daily-scrape.ts — backlog-aware top-up from list + Apify (the daily entry)
    store.ts        — shared fetch/store/dedup/location helpers
    company-list.json — 50 verified ATS boards (greenhouse/lever/ashby)
  matcher/          — Gemini scoring (oldest first) + prompts
  resume-generator/ — 2-yr ATS resume/cover letter + pdf-lib builder
  auto-apply/       — Greenhouse + Lever form submission
  email-monitor/    — Gmail OAuth2, reply classifier
  telegram-bot/     — approval messages + templates
  notion-sync/      — status sync, interview prep, skill gap writer

dashboard/          — Next.js 15 app (Render; headless Chromium for PDF)
  app/api/          — /applications, /approve, /resume, /stats endpoints
  components/       — ApplicationTable, StatsCards, ApproveButton, etc.

database/
  schema.sql        — full Postgres schema (run once in Supabase)
  seed.sql          — test data

n8n-workflows/      — 4 workflow JSONs (import via import script)
  01-daily-scrape-match.json   — daily: match backlog, then top-up scrape
  02-approve-generate.json
  03-email-monitor.json
  04-notion-sync.json

docker/
  docker-compose.yml  — n8n service
  .env.example        — Telegram vars the n8n container needs (copy to .env)

scripts/
  agent-server.js           — host HTTP server n8n calls (port 3002)
  setup.sh                  — first-time install
  import-n8n-workflows.sh   — push workflows to n8n instance
  test-all-agents.sh        — smoke test all agents
```

## Limits / Notes

- Max 15 auto-applies per day (`MAX_DAILY_APPLIES` in auto-apply agent)
- Target locations (Chennai, Bangalore, remote, India) live in `agents/scraper/store.ts` (`TARGET_LOCATIONS`)
- `daily-scrape` only tops the unscored backlog up to a target (`BACKLOG_TARGET`, default 60), split evenly between the curated list and Apify discovery
- Dedup by `jd_url`; the matcher only scores `status='scraped'`, so no job is scraped or scored twice
- All AI is Google Gemini free tier; no Anthropic key required. ~80–100 free scores/day via the model fallback chain
- Resume generation always presents exactly 2 years of experience and ATS-optimises (keyword mirroring, standard headings, no tables)
