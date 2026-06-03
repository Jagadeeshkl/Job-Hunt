import fetch from 'node-fetch';
import FormData from 'form-data';
import type { ApplyResult } from './greenhouse-submit';

export async function submitLeverApplication(params: {
  atsId: string;
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeBuffer: Buffer;
  coverLetterBuffer: Buffer;
}): Promise<ApplyResult> {
  const { atsId, jobId, firstName, lastName, email, phone, resumeBuffer, coverLetterBuffer } = params;

  const applyUrl = `https://jobs.lever.co/${atsId}/${jobId}/apply`;
  const form = new FormData();
  form.append('name', `${firstName} ${lastName}`);
  form.append('email', email);
  form.append('phone', phone);
  form.append('resume', resumeBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' });
  form.append('comments', ''); // cover letter text as comments field
  form.append(
    'coverLetter',
    coverLetterBuffer,
    { filename: 'cover-letter.pdf', contentType: 'application/pdf' }
  );

  try {
    const res = await fetch(applyUrl, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0 (compatible; JobAgentBot/1.0)',
      },
    });

    const body = await res.text();

    if (res.status === 200 || res.status === 201 || res.url.includes('thanks')) {
      return { success: true, requiresManual: false };
    }

    if (body.toLowerCase().includes('captcha') || res.status === 403) {
      return { success: false, requiresManual: true, error: 'CAPTCHA detected' };
    }

    return {
      success: false,
      requiresManual: true,
      error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return { success: false, requiresManual: true, error: String(err) };
  }
}
