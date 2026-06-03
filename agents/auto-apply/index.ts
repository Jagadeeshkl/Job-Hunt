import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { submitGreenhouseApplication } from './greenhouse-submit';
import { submitLeverApplication } from './lever-submit';
import baseResume from '../resume-generator/base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const MAX_DAILY_APPLIES = 15;

const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--id='));
const applicationId = idArg ? idArg.split('=')[1] : null;

async function getDailyApplyCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .gte('applied_at', `${today}T00:00:00Z`)
    .lte('applied_at', `${today}T23:59:59Z`);

  return count ?? 0;
}

async function fetchPdfAsBuffer(url: string): Promise<Buffer> {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!applicationId) {
    console.error('[auto-apply] --id=<uuid> is required');
    process.exit(1);
  }

  const dailyCount = await getDailyApplyCount();
  if (dailyCount >= MAX_DAILY_APPLIES) {
    console.log(`[auto-apply] Daily limit reached (${dailyCount}/${MAX_DAILY_APPLIES}). Stopping.`);
    return;
  }

  const { data: app, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (error || !app) {
    console.error('[auto-apply] Application not found:', error?.message);
    process.exit(1);
  }

  if (app.is_manual_required) {
    console.log(`[auto-apply] ${app.company} flagged as manual. Skipping.`);
    return;
  }

  if (!app.resume_storage_url || !app.cover_letter_storage_url) {
    console.error('[auto-apply] PDFs not generated yet for application', applicationId);
    process.exit(1);
  }

  console.log(`[auto-apply] Applying to ${app.company} — ${app.role}…`);

  const resumeBuffer = await fetchPdfAsBuffer(app.resume_storage_url);
  const coverBuffer = await fetchPdfAsBuffer(app.cover_letter_storage_url);

  const nameParts = (baseResume as any).name.split(' ');
  const firstName = nameParts[0] ?? 'First';
  const lastName = nameParts.slice(1).join(' ') || 'Last';
  const email = (baseResume as any).contact?.email ?? '';
  const phone = (baseResume as any).contact?.phone ?? '';

  // Extract job ID from JD URL
  const jobIdMatch = app.jd_url.match(/\/(\d+)$/) ?? app.jd_url.match(/\/([a-f0-9-]{36})$/i);
  const jobId = jobIdMatch ? jobIdMatch[1] : '';

  let result;
  if (app.ats_type === 'greenhouse') {
    result = await submitGreenhouseApplication({
      atsId: app.company.toLowerCase().replace(/\s+/g, '-'),
      jobId,
      firstName,
      lastName,
      email,
      phone,
      resumeBuffer,
      coverLetterBuffer: coverBuffer,
    });
  } else if (app.ats_type === 'lever') {
    result = await submitLeverApplication({
      atsId: app.company.toLowerCase().replace(/\s+/g, '-'),
      jobId,
      firstName,
      lastName,
      email,
      phone,
      resumeBuffer,
      coverLetterBuffer: coverBuffer,
    });
  } else {
    console.log(`[auto-apply] ATS type '${app.ats_type}' requires manual apply.`);
    await supabase
      .from('applications')
      .update({ is_manual_required: true })
      .eq('id', applicationId);
    return;
  }

  if (result.success) {
    await supabase
      .from('applications')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', applicationId);
    console.log(`[auto-apply] Successfully applied to ${app.company}.`);
  } else {
    await supabase
      .from('applications')
      .update({ is_manual_required: true })
      .eq('id', applicationId);
    console.warn(`[auto-apply] Failed for ${app.company}: ${result.error}. Flagged for manual apply.`);
  }
}

main().catch(err => {
  console.error('[auto-apply] Fatal:', err);
  process.exit(1);
});
