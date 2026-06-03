import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { generateInterviewQuestions } from './interview-prep';
import { writeSkillGapToNotion } from './skill-gap-writer';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--id='));
const applicationId = idArg ? idArg.split('=')[1] : null;
const isDryRun = args.includes('--dry-run');

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

const STATUS_TO_NOTION: Record<string, string> = {
  scraped: 'Scraped',
  matched: 'Matched',
  approved: 'Approved',
  applied: 'Applied',
  interview_scheduled: 'Interview Scheduled',
  assessment: 'Assessment',
  rejected: 'Rejected',
  offer: 'Offer',
};

async function createOrUpdateNotionPage(app: any): Promise<string> {
  // Check if page already exists for this application
  const searchRes = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: 'JD URL', url: { equals: app.jd_url } },
    }),
  });
  const searchData: any = await searchRes.json();
  const existing = searchData?.results?.[0];

  const properties: any = {
    Company: { title: [{ text: { content: app.company } }] },
    Role: { rich_text: [{ text: { content: app.role } }] },
    Status: { select: { name: STATUS_TO_NOTION[app.status] ?? app.status } },
    'Match Score': { number: app.match_score ?? 0 },
    'JD URL': { url: app.jd_url },
    'Prep Status': { select: { name: 'Not Started' } },
  };

  if (app.missing_skills?.length) {
    properties['Missing Skills'] = {
      multi_select: app.missing_skills.slice(0, 10).map((s: string) => ({ name: s })),
    };
  }

  if (app.applied_at) {
    properties['Applied Date'] = { date: { start: app.applied_at } };
  }

  let pageId: string;

  if (existing) {
    await fetch(`${NOTION_API}/pages/${existing.id}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({ properties }),
    });
    pageId = existing.id;
  } else {
    const createRes = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties }),
    });
    const createData: any = await createRes.json();
    pageId = createData.id;
  }

  return pageId;
}

async function syncApplication(app: any): Promise<void> {
  console.log(`[notion-sync] Syncing ${app.company} — ${app.role}…`);

  const pageId = await createOrUpdateNotionPage(app);

  if (app.missing_skills?.length) {
    const questions = await generateInterviewQuestions(app.missing_skills);
    await writeSkillGapToNotion({ pageId, missingSkills: app.missing_skills, interviewQuestions: questions });
  }
}

async function main() {
  if (isDryRun) {
    console.log('[notion-sync] dry-run: would sync applications to Notion.');
    return;
  }

  if (applicationId) {
    const { data: app, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    if (error || !app) {
      console.error('[notion-sync] Application not found:', error?.message);
      process.exit(1);
    }
    await syncApplication(app);
  } else {
    // Full re-sync: all applied or higher
    const { data: apps, error } = await supabase
      .from('applications')
      .select('*')
      .in('status', ['applied', 'interview_scheduled', 'assessment', 'offer']);

    if (error) throw new Error(error.message);
    for (const app of apps ?? []) {
      await syncApplication(app);
      await new Promise(r => setTimeout(r, 300)); // rate limit
    }
  }

  console.log('[notion-sync] Done.');
}

main().catch(err => {
  console.error('[notion-sync] Fatal:', err);
  process.exit(1);
});
