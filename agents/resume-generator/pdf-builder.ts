import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ResumeData {
  name: string;
  contact: {
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    location: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    role: string;
    duration: string;
    bullets: string[];
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    concepts: string[];
  };
  education: Array<{ degree: string; institution: string; year: string }>;
  projects: Array<{ name: string; description: string; tech: string[] }>;
}

const MARGIN = 50;
const PAGE_WIDTH = 612;
const LINE_HEIGHT = 14;
const SECTION_GAP = 10;

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildResumePdf(resumeData: ResumeData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, 792]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 742;
  const x = MARGIN;
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const charsPerLine = Math.floor(contentWidth / 6);

  const draw = (text: string, opts: { bold?: boolean; size?: number; x?: number }) => {
    const font = opts.bold ? bold : regular;
    const size = opts.size ?? 10;
    page.drawText(text, { x: opts.x ?? x, y, font, size, color: rgb(0, 0, 0) });
    y -= LINE_HEIGHT;
  };

  const drawLine = () => {
    page.drawLine({ start: { x, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= 6;
  };

  const section = (title: string) => {
    y -= SECTION_GAP;
    draw(title.toUpperCase(), { bold: true, size: 11 });
    drawLine();
  };

  // Header
  draw(resumeData.name, { bold: true, size: 16 });
  const contactLine = [resumeData.contact.email, resumeData.contact.phone, resumeData.contact.location].join('  |  ');
  draw(contactLine, { size: 9 });
  const linksLine = [resumeData.contact.linkedin, resumeData.contact.github].join('  |  ');
  draw(linksLine, { size: 9 });

  // Summary
  section('Summary');
  for (const line of wrap(resumeData.summary, charsPerLine)) {
    draw(line, {});
  }

  // Experience
  section('Experience');
  for (const exp of resumeData.experience) {
    draw(`${exp.role} — ${exp.company}`, { bold: true });
    draw(exp.duration, { size: 9 });
    for (const bullet of exp.bullets) {
      for (const line of wrap(`• ${bullet}`, charsPerLine - 2)) {
        draw(line, { x: x + 8 });
      }
    }
    y -= 4;
  }

  // Skills
  section('Skills');
  const skillGroups = [
    ['Languages', resumeData.skills.languages],
    ['Frameworks', resumeData.skills.frameworks],
    ['Tools', resumeData.skills.tools],
    ['Concepts', resumeData.skills.concepts],
  ] as [string, string[]][];
  for (const [label, items] of skillGroups) {
    if (items.length > 0) {
      draw(`${label}: ${items.join(', ')}`, {});
    }
  }

  // Education
  section('Education');
  for (const edu of resumeData.education) {
    draw(`${edu.degree} — ${edu.institution} (${edu.year})`, {});
  }

  // Projects
  section('Projects');
  for (const proj of resumeData.projects) {
    draw(proj.name, { bold: true });
    for (const line of wrap(proj.description, charsPerLine)) {
      draw(line, {});
    }
    draw(`Tech: ${proj.tech.join(', ')}`, { size: 9 });
    y -= 4;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function buildCoverLetterPdf(
  text: string,
  candidateName: string,
  company: string,
  role: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, 792]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 720;
  const x = MARGIN;
  const charsPerLine = Math.floor((PAGE_WIDTH - MARGIN * 2) / 6);

  page.drawText(`${candidateName}`, { x, y, font: bold, size: 13, color: rgb(0, 0, 0) });
  y -= LINE_HEIGHT * 2;

  page.drawText(`Re: ${role} at ${company}`, { x, y, font: bold, size: 11, color: rgb(0, 0, 0) });
  y -= LINE_HEIGHT * 2;

  for (const paragraph of text.split('\n\n')) {
    for (const line of wrap(paragraph, charsPerLine)) {
      page.drawText(line, { x, y, font: regular, size: 10, color: rgb(0, 0, 0) });
      y -= LINE_HEIGHT;
    }
    y -= LINE_HEIGHT;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
