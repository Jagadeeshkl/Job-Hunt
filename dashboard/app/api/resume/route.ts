import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const RESUME_DIR = path.resolve(process.cwd(), '..', 'public-resume');
const RESUME_PATH = path.join(RESUME_DIR, 'resume.pdf');
const META_PATH = path.join(RESUME_DIR, 'resume-meta.json');

export async function GET() {
  if (!existsSync(RESUME_PATH)) {
    return NextResponse.json({ exists: false });
  }
  try {
    const meta = existsSync(META_PATH)
      ? JSON.parse(await readFile(META_PATH, 'utf-8'))
      : { name: 'resume.pdf', uploadedAt: null };
    return NextResponse.json({ exists: true, ...meta });
  } catch {
    return NextResponse.json({ exists: false });
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('resume') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!file.name.endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 400 });
  }

  if (!existsSync(RESUME_DIR)) {
    await mkdir(RESUME_DIR, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  await writeFile(RESUME_PATH, Buffer.from(bytes));

  const meta = {
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    path: RESUME_PATH,
  };
  await writeFile(META_PATH, JSON.stringify(meta, null, 2));

  return NextResponse.json({ ok: true, ...meta });
}
