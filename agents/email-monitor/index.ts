import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from './gmail-auth';
import { classifyEmail } from './classifier';
import { sendTelegramAlert } from '../telegram-bot/index';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SEARCH_QUERY =
  'subject:(interview OR assessment OR test OR invitation OR offer OR congratulations OR "next steps") newer_than:1d';

const isDryRun = process.argv.includes('--dry-run');

interface GmailMessage {
  id: string;
  threadId: string;
}

function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractHeader(headers: any[], name: string): string {
  return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function domainFromEmail(email: string): string {
  const m = email.match(/@([\w.]+)/);
  return m ? m[1].split('.')[0] : '';
}

function extractTextBody(payload: any): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractTextBody(part);
    if (text) return text;
  }
  return '';
}

async function listMessages(token: string): Promise<GmailMessage[]> {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(SEARCH_QUERY)}&maxResults=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json();
  return data.messages ?? [];
}

async function getMessage(token: string, id: string): Promise<any> {
  const res = await fetch(`${GMAIL_BASE}/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function findApplicationByCompany(company: string): Promise<string | null> {
  const { data } = await supabase
    .from('applications')
    .select('id')
    .ilike('company', `%${company}%`)
    .limit(1)
    .single();
  return data?.id ?? null;
}

const STATUS_MAP: Record<string, string> = {
  interview_invite: 'interview_scheduled',
  test_assignment: 'assessment',
  screening_call: 'interview_scheduled',
};

async function main() {
  if (isDryRun) {
    console.log('[email-monitor] dry-run: would poll Gmail but skipping.');
    return;
  }

  console.log('[email-monitor] Polling Gmail…');
  const token = await getAccessToken();
  const messages = await listMessages(token);

  if (messages.length === 0) {
    console.log('[email-monitor] No new messages found.');
    return;
  }

  for (const msg of messages) {
    // Skip already-processed messages
    const { data: existing } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('gmail_message_id', msg.id)
      .single();

    if (existing) continue;

    const full = await getMessage(token, msg.id);
    const headers = full.payload?.headers ?? [];
    const subject = extractHeader(headers, 'subject');
    const from = extractHeader(headers, 'from');
    const body = extractTextBody(full.payload ?? {});

    const classification = await classifyEmail(subject, body);
    const company = domainFromEmail(from);
    const applicationId = await findApplicationByCompany(company);

    await supabase.from('communication_logs').insert({
      application_id: applicationId,
      email_subject: subject,
      email_snippet: body.slice(0, 300),
      classification,
      gmail_message_id: msg.id,
      telegram_sent: false,
    });

    if (['interview_invite', 'test_assignment', 'screening_call'].includes(classification)) {
      await sendTelegramAlert({ company, classification, email_subject: subject });

      await supabase
        .from('communication_logs')
        .update({ telegram_sent: true })
        .eq('gmail_message_id', msg.id);

      if (applicationId && STATUS_MAP[classification]) {
        await supabase
          .from('applications')
          .update({ status: STATUS_MAP[classification] })
          .eq('id', applicationId);
      }
    }

    console.log(`[email-monitor] ${from} → ${classification}`);
  }

  console.log('[email-monitor] Done.');
}

main().catch(err => {
  console.error('[email-monitor] Fatal:', err);
  process.exit(1);
});
