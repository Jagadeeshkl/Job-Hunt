# SKILLS.md — External Integrations Reference

## Anthropic Claude API
- Endpoint: https://api.anthropic.com/v1/messages
- Model: claude-sonnet-4-6
- Used for: job matching, resume tailoring, cover letter, email classification
- Docs: https://docs.anthropic.com/en/api/messages

## Supabase
- JS SDK: @supabase/supabase-js
- Storage SDK: included in above
- Used for: applications table, communication_logs table, PDF file storage
- Auth: SUPABASE_URL + SUPABASE_ANON_KEY (read) / SUPABASE_SERVICE_KEY (write)

## n8n REST API (for programmatic workflow import)
- Base URL: http://localhost:5678/api/v1
- Auth: n8n API key (set in n8n settings)
- Import workflow: POST /workflows with JSON body
- Activate workflow: PATCH /workflows/{id}/activate

## Apify API
- Endpoint: https://api.apify.com/v2/acts/apify~google-search-scraper/runs
- Auth: Bearer APIFY_API_TOKEN
- Used for: Google Search queries to find new job URLs
- Cost: ~$0.005 per search query

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
- Returns: JSON array of job postings

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
