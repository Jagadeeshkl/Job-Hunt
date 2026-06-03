import fetch from 'node-fetch';
import FormData from 'form-data';

export interface ApplyResult {
  success: boolean;
  requiresManual: boolean;
  error?: string;
}

export async function submitGreenhouseApplication(params: {
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

  // Extract numeric job ID from URL if full URL passed
  const numericJobId = jobId.replace(/\D/g, '');

  const url = `https://boards-api.greenhouse.io/v1/boards/${atsId}/jobs/${numericJobId}`;

  // First verify the job still exists
  try {
    const checkRes = await fetch(url, { method: 'GET' });
    if (!checkRes.ok) {
      return { success: false, requiresManual: true, error: `Job ${numericJobId} not found (${checkRes.status})` };
    }
  } catch (err) {
    return { success: false, requiresManual: true, error: `Job check failed: ${err}` };
  }

  // Build multipart form — Greenhouse apply endpoint
  const applyUrl = `https://boards-api.greenhouse.io/v1/boards/${atsId}/jobs/${numericJobId}`;
  const form = new FormData();
  form.append('first_name', firstName);
  form.append('last_name', lastName);
  form.append('email', email);
  form.append('phone', phone);
  form.append('resume', resumeBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' });
  form.append('cover_letter', coverLetterBuffer, {
    filename: 'cover-letter.pdf',
    contentType: 'application/pdf',
  });

  try {
    const res = await fetch(applyUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const body = await res.text();

    if (res.status === 200 || res.status === 201) {
      return { success: true, requiresManual: false };
    }

    // CAPTCHA or anti-bot response
    if (body.toLowerCase().includes('captcha') || res.status === 403) {
      return { success: false, requiresManual: true, error: 'CAPTCHA detected' };
    }

    return { success: false, requiresManual: true, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { success: false, requiresManual: true, error: String(err) };
  }
}
