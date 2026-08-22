// Locked resume template — the blue/white look approved by the user, in the
// ATS-optimised SINGLE-COLUMN layout (was two-column with a left sidebar).
// Renders a BaseResume (agents/resume-generator/base-resume.json) + per-job
// tailoring into a print-ready HTML string. Facts come from the JSON; tailoring
// only sets the headline, summary text, and project order.
//
// Why single column: a PDF's text layer is what an ATS reads, and a two-column
// body linearises the whole sidebar BEFORE the right-hand content — Experience
// landed around the halfway mark. Measured on the real resume, moving to one
// column took the current role from line 45 to line 12 of the extracted text.
// Keep it one column; keep skills as comma-separated text, not chips.

export interface BaseResume {
  name: string;
  contact: {
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    location: string;
  };
  summary: string;
  experience: {
    company: string;
    role: string;
    duration: string;
    bullets: string[];
  }[];
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    concepts: string[];
  };
  education: {
    degree: string;
    institution: string;
    year?: string;
    duration?: string;
    grade: string;
  }[];
  projects: {
    name: string;
    description: string;
    tech: string[];
  }[];
  certifications: string[];
  strengths?: string[];
  spoken_languages?: string[];
}

export interface ResumeTailoring {
  /** Subtitle under the name, e.g. "Machine Learning Engineer — AI & Data Science Graduate". */
  headline: string;
  /** Tailored profile-summary paragraph (facts unchanged, framing adjusted). */
  summary: string;
  /** Project names in the order they should appear; unknown names ignored, the rest appended. */
  projectOrder?: string[];
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

// Split a project description paragraph into 2–3 sentence bullets.
function toBullets(description: string): string[] {
  return description
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function orderProjects(projects: BaseResume['projects'], order?: string[]): BaseResume['projects'] {
  if (!order || order.length === 0) return projects;
  const byName = new Map(projects.map(p => [p.name.toLowerCase(), p]));
  const seen = new Set<string>();
  const out: BaseResume['projects'] = [];
  for (const name of order) {
    // match on a loose substring so Gemini's slightly-reworded names still line up
    const key = [...byName.keys()].find(
      k => k === name.toLowerCase() || k.includes(name.toLowerCase()) || name.toLowerCase().includes(k)
    );
    if (key && !seen.has(key)) {
      out.push(byName.get(key)!);
      seen.add(key);
    }
  }
  for (const p of projects) {
    if (!seen.has(p.name.toLowerCase())) out.push(p);
  }
  return out;
}

export function renderResumeHTML(data: BaseResume, t: ResumeTailoring): string {
  const c = data.contact;
  const projects = orderProjects(data.projects, t.projectOrder);

  const certItems = data.certifications
    .map(cert => `<div class="certline">${esc(cert)}</div>`)
    .join('');

  // Grade and dates share one line here (they were stacked in the sidebar layout);
  // full width means they fit, and it saves a line per entry.
  const eduItems = data.education
    .map(
      e => `<div class="item">
          <div class="title">${esc(e.degree)}</div>
          <div class="org">${esc(e.institution)}</div>
          <div><span class="grade">${esc(e.grade)}</span> <span class="meta">${esc(e.duration || e.year || '')}</span></div>
        </div>`
    )
    .join('');

  const expEntries = data.experience
    .map(
      x => `<div class="entry">
          <div class="row">
            <span class="role">${esc(x.role)}</span>
            <span class="date">${esc(x.duration)}</span>
          </div>
          <div class="where">${esc(x.company)}</div>
          <ul class="bullets">${x.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>`
    )
    .join('');

  const projEntries = projects
    .map(
      p => `<div class="entry">
          <div class="row">
            <span class="role">${esc(p.name)}</span>
          </div>
          <div class="stack">${p.tech.map(esc).join(' · ')}</div>
          <ul class="bullets">${toBullets(p.description).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>`
    )
    .join('');

  const skillGroups: [string, string[]][] = [
    ['Languages', data.skills.languages],
    ['Frameworks & Libraries', data.skills.frameworks],
    ['Tools & Platforms', data.skills.tools],
    ['Concepts', data.skills.concepts],
  ];
  if (data.strengths && data.strengths.length) skillGroups.push(['Strengths', data.strengths]);
  // Spoken languages ride along as a labelled row instead of owning a section —
  // two words did not justify a heading, and the "Spoken Languages:" label keeps
  // the term available to keyword matching.
  if (data.spoken_languages && data.spoken_languages.length) {
    skillGroups.push(['Spoken Languages', data.spoken_languages]);
  }

  // Comma-separated text, NOT flex chips. Chips wrap onto their own lines and the
  // PDF text layer then emits each stray one alone ("Power BI" on its own line),
  // which breaks the grouping an ATS reads.
  const skillsHTML = skillGroups
    .filter(([, items]) => items && items.length)
    .map(
      ([lbl, items]) =>
        `<div class="skillrow"><span class="lbl">${esc(lbl)}:</span> ${items.map(esc).join(', ')}</div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(data.name)} — Resume</title>
<style>
  :root{ --blue:#1f54d6; --blue-dark:#1842ad; --ink:#1f2430; --muted:#555c6b; --rule:#1f54d6; --soft:#eef3ff; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  @page{ size:A4; margin:0; }
  html,body{ background:#fff; }
  body{ font-family:"Carlito","Calibri","Segoe UI",Arial,sans-serif; color:var(--ink); font-size:10.2px; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; padding:12mm 15mm 9mm; margin:0 auto; }
  header{ text-align:center; padding-bottom:8px; }
  h1{ font-size:30px; letter-spacing:2px; font-weight:700; color:var(--blue); text-transform:uppercase; }
  .subtitle{ font-size:12px; font-weight:700; color:var(--ink); margin-top:3px; letter-spacing:.3px; }
  .contact{ margin-top:7px; font-size:10px; color:var(--muted); display:flex; justify-content:center; flex-wrap:wrap; gap:6px 14px; }
  .contact a{ color:var(--blue-dark); text-decoration:none; font-weight:600; }
  .contact .sep{ color:#c7cddb; }
  .hrule{ height:2.4px; background:var(--rule); border-radius:2px; margin:8px 0 0; }
  h2{ font-size:11.5px; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:.8px; margin:0 0 6px; padding-bottom:3px; border-bottom:1.6px solid var(--rule); }
  section{ margin-top:10px; }
  .item{ margin-bottom:7px; }
  .item:last-child{ margin-bottom:0; }
  .item .title{ font-weight:700; color:var(--ink); font-size:10.6px; }
  .item .org{ color:var(--muted); }
  .item .meta{ color:var(--muted); font-size:9.4px; font-style:italic; }
  .item .grade{ font-weight:600; color:var(--blue-dark); }
  .skillrow{ margin-bottom:3px; }
  .skillrow .lbl{ font-weight:700; color:var(--ink); }
  .certline{ margin-bottom:4px; color:var(--ink); }
  /* Education and Certifications share the closing row so they cost one band of
     vertical space, not two. It is the only split region and it is safe: each
     column is a WHOLE section with its own heading, so the linearised order stays
     "EDUCATION -> its items -> CERTIFICATIONS -> its items" and no entry is torn
     in half. Note a flex container cannot break across pages — if this row does
     not fit it moves to page 2 intact rather than filling the gap. */
  .footer-row{ display:flex; gap:26px; margin-top:10px; align-items:flex-start; }
  .footer-row > section{ flex:1; margin-top:0; }
  .summary{ text-align:justify; color:var(--ink); }
  .entry{ margin-bottom:9px; }
  .entry:last-child{ margin-bottom:0; }
  .entry .row{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .entry .role{ font-weight:700; color:var(--ink); font-size:11px; }
  .entry .date{ color:var(--muted); font-size:9.3px; font-style:italic; white-space:nowrap; }
  .entry .where{ color:var(--blue-dark); font-weight:600; font-size:10px; margin-top:1px; }
  .entry .stack{ color:var(--muted); font-size:9.3px; font-style:italic; margin-top:1px; }
  ul.bullets{ list-style:none; margin-top:4px; }
  ul.bullets li{ position:relative; padding-left:12px; margin-bottom:2.5px; color:var(--ink); }
  ul.bullets li::before{ content:""; position:absolute; left:2px; top:5px; width:4px; height:4px; border-radius:50%; background:var(--blue); }
  b{ color:var(--ink); }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>${esc(data.name)}</h1>
    <div class="subtitle">${esc(t.headline)}</div>
    <div class="contact">
      <!-- No emoji here: Chromium emits it as an unpaired surrogate pair
           (ED A0 BD ED B3 8D), which is invalid UTF-8. Strict ATS parsers throw
           on it and lenient ones render U+FFFD next to the location. -->
      <span>${esc(c.location)}</span>
      <span class="sep">|</span>
      <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>
      <span class="sep">|</span>
      <span>${esc(c.phone)}</span>
      <span class="sep">|</span>
      <a href="${esc(c.github)}">${esc(stripProto(c.github))}</a>
      <span class="sep">|</span>
      <a href="${esc(c.linkedin)}">${esc(stripProto(c.linkedin))}</a>
    </div>
    <div class="hrule"></div>
  </header>

  <!-- Single column, in the order an ATS should read it. The old two-column body
       emitted the ENTIRE sidebar (Education, Skills, Certifications, Languages,
       Links) into the text layer before Experience, pushing the current role to
       roughly the halfway mark. Experience now sits near the top.
       The old "Links" section is gone: the header above already carries GitHub,
       LinkedIn, email and phone, so it only duplicated four values and spent a
       heading plus four lines doing it. -->
  <section><h2>Professional Summary</h2><p class="summary">${esc(t.summary)}</p></section>
  <section><h2>Technical Skills</h2>${skillsHTML}</section>
  <section><h2>Experience</h2>${expEntries}</section>
  <section><h2>Projects</h2>${projEntries}</section>

  <div class="footer-row">
    <section><h2>Education</h2>${eduItems}</section>
    <section><h2>Certifications</h2>${certItems}</section>
  </div>
</div>
</body>
</html>`;
}
