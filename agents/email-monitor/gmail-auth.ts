import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed: ${body}`);
  }

  const data: any = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

// Run standalone to get initial refresh token via OAuth flow
if (require.main === module) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.local first.');
    process.exit(1);
  }

  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nAfter authorising, you will get a code. Run:');
  console.log(`npx ts-node agents/email-monitor/gmail-auth.ts --code=YOUR_CODE_HERE`);

  const codeArg = process.argv.find(a => a.startsWith('--code='));
  if (codeArg) {
    const code = codeArg.split('=')[1];
    fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
      .then(r => r.json())
      .then((data: any) => {
        console.log('\nAdd this to .env.local:');
        console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
      });
  }
}
