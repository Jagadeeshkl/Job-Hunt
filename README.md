# Job Agent

Autonomous job application system. Scrapes AI/ML job listings from Greenhouse, Lever, and Ashby ATS APIs, scores them against your resume, generates tailored resumes and cover letters, auto-applies, monitors Gmail for responses, and syncs everything to Notion.

## Architecture

```
Greenhouse / Lever / Ashby APIs
        │
        ▼
   [scraper] ──► Supabase (status: scraped)
        │
        ▼
   [matcher] ──► Gemini Flash scores 0–100 (status: matched)
        │
        ▼
  Telegram bot ──► manual approve/reject
        │
        ▼
 [resume-generator] ──► Claude generates resume + cover letter PDF
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

n8n orchestrates the daily cron (02:30 UTC / 08:00 IST) and the Telegram approval webhook.

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
| `GOOGLE_API_KEY` | Google AI Studio → Create API key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `APIFY_API_TOKEN` | apify.com → Settings → Integrations |
| `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` | GCP Console → OAuth2, then run the auth script |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | @BotFather → new bot; chat ID from @userinfobot |
| `NOTION_API_KEY` / `NOTION_DATABASE_ID` | Notion → Settings → Integrations |
| `N8N_WEBHOOK_URL` / `N8N_BASE_URL` / `N8N_API_KEY` | n8n instance settings |

### 3. Set up Supabase

Paste `database/schema.sql` into the Supabase SQL editor and run it. Optionally run `database/seed.sql` for test data.

### 4. Start n8n

```bash
docker compose -f docker/docker-compose.yml up -d
```

Then import workflows:

```bash
bash scripts/import-n8n-workflows.sh
```

### 5. Smoke test

```bash
bash scripts/test-all-agents.sh
```

### 6. Start dashboard

```bash
cd dashboard && pnpm dev   # http://localhost:3000
```

## Running Agents Manually

```bash
npm run scrape      # fetch new jobs from ATS APIs → Supabase
npm run match       # score scraped jobs with Gemini
npm run email       # check Gmail, classify replies, update statuses
npm run dev         # Next.js dashboard
```

## Application Status Pipeline

```
scraped → matched → approved → applied → interview_scheduled → assessment → rejected / offer
```

| Status | Set by |
|--------|--------|
| `scraped` | scraper on insert |
| `matched` | matcher after scoring |
| `approved` | Telegram bot (manual) |
| `applied` | auto-apply agent |
| `interview_scheduled` | email-monitor |
| `assessment` | email-monitor |
| `rejected` | email-monitor |
| `offer` | email-monitor |

Jobs with `is_manual_required = true` (Workday, custom portals) skip auto-apply and stay in the dashboard queue.

## Key File Locations

```
agents/
  scraper/          — fetches jobs from Greenhouse, Lever, Ashby
  matcher/          — Gemini scoring + prompts
  resume-generator/ — Claude resume/cover letter + pdf-lib builder
  auto-apply/       — Greenhouse + Lever form submission
  email-monitor/    — Gmail OAuth2, reply classifier
  telegram-bot/     — approval messages + templates
  notion-sync/      — status sync, interview prep, skill gap writer

dashboard/          — Next.js 14 app (Vercel)
  app/api/          — /applications, /approve, /resume, /stats endpoints
  components/       — ApplicationTable, StatsCards, ApproveButton, etc.

database/
  schema.sql        — full Postgres schema (run once in Supabase)
  seed.sql          — test data

n8n-workflows/      — 4 workflow JSONs (import via import script)
  01-daily-scrape-match.json
  02-approve-generate.json
  03-email-monitor.json
  04-notion-sync.json

scripts/
  setup.sh                  — first-time install
  import-n8n-workflows.sh   — push workflows to n8n instance
  test-all-agents.sh        — smoke test all agents
```

## Limits / Notes

- Max 15 auto-applies per day (`MAX_DAILY_APPLIES` in auto-apply agent)
- Scraper targets Chennai, Bangalore, and remote roles only — edit `TARGET_LOCATIONS` in `agents/scraper/index.ts`
- Deduplication is by `jd_url` — same listing from two runs is inserted once
- Anthropic API used only for resume + cover letter generation (expensive); Gemini Flash handles matching and classification (free tier)
