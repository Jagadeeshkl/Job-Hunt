// Locked cover-letter template — matches the resume header look. Body paragraphs
// are written per-job by Gemini; contact/name come from the BaseResume.

import type { BaseResume } from './resume-template';

export interface CoverLetterTailoring {
  headline: string;
  /** Pre-formatted date string, e.g. "7 June 2026". */
  date: string;
  company: string;
  /** Recipient location line, e.g. "Chennai, Tamil Nadu, India". Optional. */
  companyLocation?: string;
  roleTitle: string;
  /** Body paragraphs (already written, factual). */
  paragraphs: string[];
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripProto(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function renderCoverLetterHTML(data: BaseResume, t: CoverLetterTailoring): string {
  const c = data.contact;
  const body = t.paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(data.name)} — Cover Letter</title>
<style>
  :root{ --blue:#1f54d6; --blue-dark:#1842ad; --ink:#1f2430; --muted:#555c6b; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  @page{ size:A4; margin:0; }
  html,body{ background:#fff; }
  body{ font-family:"Carlito","Calibri","Segoe UI",Arial,sans-serif; color:var(--ink); font-size:11px; line-height:1.6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; padding:18mm 20mm; margin:0 auto; }
  header{ text-align:center; padding-bottom:10px; }
  h1{ font-size:26px; letter-spacing:2px; font-weight:700; color:var(--blue); text-transform:uppercase; }
  .subtitle{ font-size:11px; font-weight:700; color:var(--ink); margin-top:2px; }
  .contact{ margin-top:6px; font-size:9.6px; color:var(--muted); display:flex; justify-content:center; flex-wrap:wrap; gap:4px 12px; }
  .contact a{ color:var(--blue-dark); text-decoration:none; font-weight:600; }
  .contact .sep{ color:#c7cddb; }
  .hrule{ height:2.4px; background:var(--blue); border-radius:2px; margin:9px 0 22px; }
  .meta{ margin-bottom:18px; color:var(--ink); }
  .meta .date{ margin-bottom:14px; }
  .meta .to b{ color:var(--ink); }
  .meta .to{ color:var(--muted); line-height:1.5; }
  .subject{ font-weight:700; color:var(--blue-dark); margin:4px 0 16px; }
  p{ margin-bottom:12px; text-align:justify; }
  .greeting{ margin-bottom:14px; text-align:left; }
  .sign{ margin-top:22px; }
  .sign .name{ font-weight:700; color:var(--blue-dark); font-size:13px; margin-top:2px; }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>${esc(data.name)}</h1>
    <div class="subtitle">${esc(t.headline)}</div>
    <div class="contact">
      <!-- No emoji: see the note in resume-template.ts — it becomes invalid UTF-8. -->
      <span>${esc(c.location)}</span>
      <span class="sep">|</span>
      <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>
      <span class="sep">|</span>
      <span>${esc(c.phone)}</span>
      <span class="sep">|</span>
      <a href="${esc(c.linkedin)}">${esc(stripProto(c.linkedin))}</a>
    </div>
    <div class="hrule"></div>
  </header>

  <div class="meta">
    <div class="date">${esc(t.date)}</div>
    <div class="to">
      <b>Hiring Manager</b><br/>
      ${esc(t.company)}<br/>
      ${esc(t.companyLocation || '')}
    </div>
  </div>

  <div class="subject">Re: Application for the ${esc(t.roleTitle)} position</div>

  <p class="greeting">Dear Hiring Manager,</p>

  ${body}

  <div class="sign">
    Sincerely,
    <div class="name">${esc(data.name)}</div>
    <div>${esc(c.email)} &nbsp;|&nbsp; ${esc(c.phone)}</div>
  </div>
</div>
</body>
</html>`;
}
