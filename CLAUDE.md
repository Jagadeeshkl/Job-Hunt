# CLAUDE.md — Job Agent Project Context

## What this project does
Autonomous job application system. Scrapes AI/ML jobs, scores them, generates tailored resumes/cover letters, auto-applies, monitors email for responses, sends Telegram alerts, syncs to Notion.

## Tech Stack
- Frontend: Next.js 14, Tailwind CSS, Shadcn UI → deployed on Vercel free tier
- Database: Supabase (PostgreSQL) free tier
- Orchestration: n8n self-hosted in Docker (docker/docker-compose.yml)
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
- PDF: pdf-lib (free, zero dependency)

## How agents run
Agents are TypeScript scripts run on the HOST via `scripts/agent-server.js`
(an HTTP server on port 3002). n8n runs in Docker and triggers agents by calling
`http://host.docker.internal:3002/run/<agent>`. The agent server must be running
on the host for the workflows to work. Agents read secrets from `.env.local`.

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
- Manual apply queue for non-Greenhouse/Lever companies (Workday, custom portals)

## Application Status Pipeline
scraped → matched → approved → applied → interview_scheduled → assessment → rejected → offer

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

## n8n Workflows
5 workflow JSON files in n8n-workflows/. Workflow 01 = daily match-then-scrape
(08:00 IST). Workflow 05 = Indeed top-up, Mon & Thu 08:30 IST (lighter cadence
to conserve Apify credit; calls /run/indeed). The agent server exposes
/run/indeed for both the workflow and manual triggering.
The n8n container needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for its Telegram
nodes — supplied via docker/.env (gitignored). Import via scripts/import-n8n-workflows.sh
(or the Node importer that strips read-only fields and POSTs /activate).

### Deployment note: Docker reference vs. live cloud
The n8n-workflows/*.json files + scripts/agent-server.js are the SELF-HOSTABLE
Docker reference (n8n in Docker calls the host agents over http://host.docker.
internal:3002). The LIVE deployment, however, runs on n8n Cloud
(jagadeeshkl.app.n8n.cloud), where WF01 and WF05 are "cloud-native" rebuilds:
the scrape/insert/score logic lives directly in Apify HTTP + Code + Supabase
nodes instead of calling the host agents. Two correctness fixes apply to BOTH:
- Google discovery uses maxPagesPerQuery:3 (NOT resultsPerPage — that field is
  invalid for apify/google-search-scraper and silently caps results at ~10).
- Supabase inserts run one row at a time via a splitInBatches(batchSize 1) loop
  so a single duplicate jd_url skips itself instead of failing the whole batch.
  (In the host agents this is handled by ignore-duplicate upsert on jd_url.)
When editing live workflows, do so via the n8n MCP against the cloud instance;
the repo JSONs are not auto-synced to cloud.
