# CLAUDE.md — Job Agent Project Context

## What this project does
Autonomous job application system. Scrapes AI/ML jobs, scores them, generates tailored resumes/cover letters, auto-applies, monitors email for responses, sends Telegram alerts, syncs to Notion.

## Tech Stack
- Frontend: Next.js 14, Tailwind CSS, Shadcn UI → deployed on Vercel free tier
- Database: Supabase (PostgreSQL) free tier
- Orchestration: n8n self-hosted on Oracle Cloud Always-Free VM
- AI: Anthropic Claude API (claude-sonnet-4-6) for all AI tasks
- Job Discovery: Apify Google Search Scraper (free tier ~$0.75/month of $5 credit)
- Job Data: Greenhouse public API, Lever public API, Ashby public API (no auth needed)
- Email: Gmail API with OAuth2
- Alerts: Telegram Bot API (free)
- Notion: Notion API (free)
- PDF: pdf-lib (free, zero dependency)

## Environment Variables needed
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
APIFY_API_TOKEN=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NOTION_API_KEY=
NOTION_DATABASE_ID=
N8N_WEBHOOK_URL=
N8N_BASE_URL=
N8N_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

## Key Rules
- Never use Playwright on LinkedIn or Indeed (gets banned)
- Only use Apify for Google Search queries (cheap), fetch JD text from public ATS APIs
- Claude API is used for: job matching, resume tailoring, cover letter, email classification, interview question generation
- All PDFs generated with pdf-lib, uploaded to Supabase Storage
- Daily cron runs at 02:30 UTC = 8:00 AM IST
- Max 15 auto-applies per day to avoid spam flagging
- Always deduplicate by jd_url before processing
- Manual apply queue for non-Greenhouse/Lever companies (Workday, custom portals)

## Application Status Pipeline
scraped → matched → approved → applied → interview_scheduled → assessment → rejected → offer

## Agent Locations
- Scraper: agents/scraper/
- Matcher: agents/matcher/
- Resume Gen: agents/resume-generator/
- Auto Apply: agents/auto-apply/
- Email Monitor: agents/email-monitor/
- Telegram: agents/telegram-bot/
- Notion Sync: agents/notion-sync/

## n8n Workflows
All 4 workflow JSON files are in n8n-workflows/. Import them via the import script.
