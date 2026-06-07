// Locked resume template — the blue/white two-column look approved by the user.
// Renders a BaseResume (agents/resume-generator/base-resume.json) + per-job
// tailoring into a print-ready HTML string. Facts come from the JSON; tailoring
// only sets the headline, summary text, and project order.

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

function handle(url: string): string {
  return stripProto(url).replace(/.*\/(in\/)?/, '').replace(/\/$/, '');
}

// Split a project description paragraph into 2–3 sentence bullets.
function toBullets(description: string): string[] {
  return description
    .split(/(?<=\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function chips(items: string[]): string {
  return `<div class="chips">${items.map(i => `<span class="chip">${esc(i)}</span>`).join('')}</div>`;
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
    .map(cert => `<div class="item"><div class="title">${esc(cert)}</div></div>`)
    .join('');

  const eduItems = data.education
    .map(
      e => `<div class="item">
          <div class="title">${esc(e.degree)}</div>
          <div class="org">${esc(e.institution)}</div>
          <div><span class="grade">${esc(e.grade)}</span></div>
          <div class="meta">${esc(e.duration || e.year || '')}</div>
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

  const skillsHTML = skillGroups
    .filter(([, items]) => items && items.length)
    .map(([lbl, items]) => `<div class="skillgroup"><div class="lbl">${esc(lbl)}</div>${chips(items)}</div>`)
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
  body{ font-family:"Carlito","Calibri","Segoe UI",Arial,sans-serif; color:var(--ink); font-size:10.3px; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; padding:14mm 13mm 12mm; margin:0 auto; }
  header{ text-align:center; padding-bottom:8px; }
  h1{ font-size:30px; letter-spacing:2px; font-weight:700; color:var(--blue); text-transform:uppercase; }
  .subtitle{ font-size:12px; font-weight:700; color:var(--ink); margin-top:3px; letter-spacing:.3px; }
  .contact{ margin-top:7px; font-size:10px; color:var(--muted); display:flex; justify-content:center; flex-wrap:wrap; gap:6px 14px; }
  .contact a{ color:var(--blue-dark); text-decoration:none; font-weight:600; }
  .contact .sep{ color:#c7cddb; }
  .hrule{ height:2.4px; background:var(--rule); border-radius:2px; margin:9px 0 0; }
  .body{ display:flex; gap:20px; margin-top:14px; }
  .left{ width:33%; }
  .right{ width:67%; }
  h2{ font-size:11.5px; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:.8px; margin:0 0 6px; padding-bottom:3px; border-bottom:1.6px solid var(--rule); }
  section{ margin-bottom:14px; }
  section:last-child{ margin-bottom:0; }
  .item{ margin-bottom:9px; }
  .item:last-child{ margin-bottom:0; }
  .item .title{ font-weight:700; color:var(--ink); font-size:10.6px; }
  .item .org{ color:var(--muted); }
  .item .meta{ color:var(--muted); font-size:9.4px; font-style:italic; }
  .item .grade{ font-weight:600; color:var(--blue-dark); }
  .skillgroup{ margin-bottom:7px; }
  .skillgroup .lbl{ font-weight:700; color:var(--ink); }
  .chips{ display:flex; flex-wrap:wrap; gap:4px; margin-top:3px; }
  .chip{ background:var(--soft); color:var(--blue-dark); border-radius:4px; padding:1.5px 6px; font-size:9.2px; font-weight:600; }
  .linklist{ list-style:none; }
  .linklist li{ margin-bottom:4px; color:var(--muted); }
  .linklist li b{ color:var(--ink); }
  .linklist a{ color:var(--blue-dark); text-decoration:none; font-weight:600; }
  .summary{ text-align:justify; color:var(--ink); }
  .entry{ margin-bottom:11px; }
  .entry:last-child{ margin-bottom:0; }
  .entry .row{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .entry .role{ font-weight:700; color:var(--ink); font-size:11px; }
  .entry .date{ color:var(--muted); font-size:9.3px; font-style:italic; white-space:nowrap; }
  .entry .where{ color:var(--blue-dark); font-weight:600; font-size:10px; margin-top:1px; }
  .entry .stack{ color:var(--muted); font-size:9.3px; font-style:italic; margin-top:1px; }
  ul.bullets{ list-style:none; margin-top:4px; }
  ul.bullets li{ position:relative; padding-left:12px; margin-bottom:3px; color:var(--ink); }
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
      <span>📍 ${esc(c.location)}</span>
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

  <div class="body">
    <div class="left">
      <section><h2>Education</h2>${eduItems}</section>
      <section><h2>Skills</h2>${skillsHTML}</section>
      <section><h2>Certifications</h2>${certItems}</section>
      ${
        data.spoken_languages && data.spoken_languages.length
          ? `<section><h2>Languages</h2>${chips(data.spoken_languages)}</section>`
          : ''
      }
      <section>
        <h2>Links</h2>
        <ul class="linklist">
          <li><b>GitHub:</b> <a href="${esc(c.github)}">${esc(handle(c.github))}</a></li>
          <li><b>LinkedIn:</b> <a href="${esc(c.linkedin)}">${esc(handle(c.linkedin))}</a></li>
          <li><b>Email:</b> ${esc(c.email)}</li>
          <li><b>Phone:</b> ${esc(c.phone)}</li>
        </ul>
      </section>
    </div>

    <div class="right">
      <section><h2>Profile Summary</h2><p class="summary">${esc(t.summary)}</p></section>
      <section><h2>Experience</h2>${expEntries}</section>
      <section><h2>Projects</h2>${projEntries}</section>
    </div>
  </div>
</div>
</body>
</html>`;
}
