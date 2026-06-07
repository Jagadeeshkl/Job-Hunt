import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  const expectedPass = process.env.DASHBOARD_PASSWORD;
  const expectedEmail = process.env.DASHBOARD_EMAIL;
  const token = process.env.AUTH_TOKEN;

  if (!expectedPass || !token) {
    return NextResponse.json({ error: 'Login is not configured on the server.' }, { status: 500 });
  }

  const passOk = typeof password === 'string' && password === expectedPass;
  const emailOk = !expectedEmail || (typeof email === 'string' && email.trim().toLowerCase() === expectedEmail.toLowerCase());

  if (!passOk || !emailOk) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('jh_auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
