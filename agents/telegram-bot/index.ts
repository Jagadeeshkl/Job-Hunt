import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { buildAlertMessage } from './message-templates';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

export async function sendTelegramAlert(params: {
  company: string;
  classification: string;
  email_subject: string;
}): Promise<void> {
  const text = buildAlertMessage(params);
  await sendMessage(text);
}

export async function sendMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[telegram] BOT_TOKEN or CHAT_ID not set — skipping.');
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[telegram] Send failed:', body);
  }
}

// Standalone test: npx ts-node agents/telegram-bot/index.ts --test
if (require.main === module) {
  const isTest = process.argv.includes('--test');
  if (isTest) {
    sendMessage('🤖 *Job Agent Bot is active!* Test message sent successfully.')
      .then(() => console.log('[telegram] Test message sent.'))
      .catch(err => console.error('[telegram] Test failed:', err));
  }
}
