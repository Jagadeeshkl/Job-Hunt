# SKILLS.md — External Integrations Reference

## Google Gemini API
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
- Auth: header `x-goog-api-key: GOOGLE_API_KEY` (or `?key=` query param)
- Primary model: gemini-2.5-flash-lite. Fallback chain (each a separate free
  daily quota bucket): gemini-2.5-flash-lite, gemini-flash-lite-latest,
  gemini-2.0-flash-lite, gemini-2.5-flash, gemini-flash-latest
- Free tier: ~20 requests/day PER model → ~80-100/day across the chain
- Used for: job matching, resume tailoring, cover letter, email classification,
  interview question generation
- All calls go through generateWithRetry() in agents/lib/gemini.ts (503 backoff,
  instant skip of daily-exhausted models, per-minute rate-limit handling)
- Docs: https://ai.google.dev/gemini-api/docs
- NOTE: gemini-1.5-flash is deprecated (404) and gemini-2.0-flash has limit:0 on
  this account — do not use either.

## Supabase
- JS SDK: @supabase/supabase-js
- Storage SDK: included in above
- Used for: applications table, communication_logs table, PDF file storage
- Auth: SUPABASE_URL + SUPABASE_ANON_KEY (read) / SUPABASE_SERVICE_KEY (write)

## n8n REST API (for programmatic workflow import)
- Base URL: http://localhost:5678/api/v1
- Auth: header `X-N8N-API-KEY` (create in n8n → Settings → API)
- Import workflow: POST /workflows — strip read-only fields first (`active`, `id`)
- Activate workflow: POST /workflows/{id}/activate (NOT PATCH)
- Delete workflow: DELETE /workflows/{id}
- The container needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in its env for the
  Telegram nodes (`{{$env.TELEGRAM_BOT_TOKEN}}`) — provided via docker/.env.

## Apify API
- Endpoint: https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token={APIFY_API_TOKEN}
  (runs synchronously and returns dataset items directly — no polling)
- Auth: token query param (APIFY_API_TOKEN)
- Used for: Google Search discovery of NEW ATS boards (site:boards.greenhouse.io
  / jobs.lever.co / jobs.ashbyhq.com + AI keywords + India locations)
- Results parsed from item.organicResults[].url
- Cost: ~$0.03 per run (3 queries)

## Greenhouse Public API (no auth required)
- Jobs list: GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs
- Single job: GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}?content=true
- Returns: JSON with title, location, content (full JD HTML)

## Lever Public API (no auth required)
- Jobs list: GET https://api.lever.co/v0/postings/{company}?mode=json
- Single job: GET https://api.lever.co/v0/postings/{company}/{job_id}
- Returns: JSON with text, categories, lists (requirements, etc.)

## Ashby Public API (no auth required)
- Jobs list: GET https://api.ashbyhq.com/posting-api/job-board/{company}
- Returns: JSON object { jobs: [...] } — NOT a bare array and NOT jobPostings.
  Each job: title, location (string), jobUrl, descriptionPlain, isRemote,
  isListed, compensation (string). Invalid board slug → HTTP 404.

## Gmail API
- OAuth2 scope: https://www.googleapis.com/auth/gmail.readonly
- List messages: GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q={query}
- Get message: GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}

## Telegram Bot API
- Send message: POST https://api.telegram.org/bot{TOKEN}/sendMessage
- Body: { chat_id, text, parse_mode: "Markdown" }

## Notion API
- Create page: POST https://api.notion.com/v1/pages
- Update page: PATCH https://api.notion.com/v1/pages/{id}
- Headers: Authorization: Bearer {NOTION_API_KEY}, Notion-Version: 2022-06-28

## pdf-lib
- Install: npm install pdf-lib
- Used for: generating resume and cover letter PDFs
