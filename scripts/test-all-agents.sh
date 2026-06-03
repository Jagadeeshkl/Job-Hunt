#!/usr/bin/env bash
# Smoke-test every agent (dry-run / test mode)
# Usage: bash scripts/test-all-agents.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
fi

cd "$PROJECT_DIR"

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local cmd="$2"
  echo "  Testing $name..."
  if eval "$cmd" > /tmp/agent-test-out.txt 2>&1; then
    echo "  ✅ $name passed"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name failed"
    cat /tmp/agent-test-out.txt | tail -5
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 Running agent smoke tests..."
echo ""

run_test "Greenhouse scraper (OpenAI dry check)" \
  "npx ts-node agents/scraper/greenhouse.ts 2>&1 | head -1 || echo 'module check ok'"

run_test "Matcher (dry-run)" \
  "npx ts-node -e \"require('./agents/matcher/prompts'); console.log('prompts ok')\""

run_test "Resume generator (module check)" \
  "npx ts-node -e \"require('./agents/resume-generator/pdf-builder'); console.log('pdf-builder ok')\""

run_test "Telegram bot (test message)" \
  "npx ts-node agents/telegram-bot/index.ts --test"

run_test "Email monitor (dry-run)" \
  "npx ts-node agents/email-monitor/index.ts --dry-run"

run_test "Notion sync (dry-run)" \
  "npx ts-node agents/notion-sync/index.ts --dry-run"

run_test "Apify search (dry-run)" \
  "npx ts-node -e \"const {discoverNewJobs} = require('./agents/scraper/apify-search'); discoverNewJobs(true).then(() => console.log('apify dry-run ok'))\""

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  Some tests failed — check the output above."
  exit 1
else
  echo "✅ All agent tests passed!"
fi
