#!/usr/bin/env node
// Lightweight HTTP server that lets n8n (Docker) trigger agents on the host.
// Usage: node scripts/agent-server.js
// Listens on port 3002. n8n calls http://host.docker.internal:3002/run/<agent>

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const PORT = 3002;

const AGENTS = {
  scraper:         ['npx', ['ts-node', 'agents/scraper/index.ts']],
  matcher:         ['npx', ['ts-node', 'agents/matcher/index.ts']],
  'email-monitor': ['npx', ['ts-node', 'agents/email-monitor/index.ts']],
  'notion-sync':   ['npx', ['ts-node', 'agents/notion-sync/index.ts']],
};

const AGENTS_WITH_ID = {
  'resume-generator': (id) => ['npx', ['ts-node', 'agents/resume-generator/index.ts', `--id=${id}`]],
  'auto-apply':       (id) => ['npx', ['ts-node', 'agents/auto-apply/index.ts', `--id=${id}`]],
  'notion-sync-id':   (id) => ['npx', ['ts-node', 'agents/notion-sync/index.ts', `--id=${id}`]],
};

function runAgent(cmd, args, res) {
  console.log(`[agent-server] Running: ${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args, { cwd: PROJECT_DIR, shell: true, env: { ...process.env } });

  let output = '';
  proc.stdout.on('data', (d) => { output += d; process.stdout.write(d); });
  proc.stderr.on('data', (d) => { output += d; process.stderr.write(d); });

  proc.on('close', (code) => {
    const status = code === 0 ? 200 : 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ exit_code: code, output }));
    console.log(`[agent-server] Done (exit ${code})`);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method !== 'POST' || parts[0] !== 'run') {
    res.writeHead(404); res.end('Not found'); return;
  }

  const agent = parts[1];
  const id = url.searchParams.get('id');

  if (id && AGENTS_WITH_ID[agent]) {
    const [cmd, args] = AGENTS_WITH_ID[agent](id);
    runAgent(cmd, args, res);
  } else if (AGENTS[agent]) {
    const [cmd, args] = AGENTS[agent];
    runAgent(cmd, args, res);
  } else {
    res.writeHead(400); res.end(JSON.stringify({ error: `Unknown agent: ${agent}` }));
  }
});

server.listen(PORT, () => {
  console.log(`[agent-server] Listening on http://localhost:${PORT}`);
  console.log(`[agent-server] n8n should call http://host.docker.internal:${PORT}/run/<agent>`);
});
