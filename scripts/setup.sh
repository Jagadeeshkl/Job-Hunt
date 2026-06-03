#!/usr/bin/env bash
# Run with: bash scripts/setup.sh
# Requires: bash (Git Bash on Windows, or bash on Linux/macOS/Oracle VM)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Setting up Job Agent System..."
echo "   Project: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# Install agent dependencies
echo ""
echo "📦 Installing agent dependencies..."
cd "$PROJECT_DIR/agents"
pnpm install

# Install dashboard dependencies
echo ""
echo "📦 Installing dashboard dependencies..."
cd "$PROJECT_DIR/dashboard"
pnpm install

cd "$PROJECT_DIR"

# Check env file
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env.local"
  echo ""
  echo "⚠️  Created .env.local from .env.example"
  echo "   Fill in your API keys before running agents."
  echo "   See the KEY SETUP ORDER section in the README."
else
  echo ""
  echo "✅ .env.local already exists."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in .env.local with your API keys"
echo "  2. Paste database/schema.sql into Supabase SQL editor"
echo "  3. Start n8n: docker compose -f docker/docker-compose.yml up -d"
echo "  4. Import workflows: bash scripts/import-n8n-workflows.sh"
echo "  5. Run smoke tests: bash scripts/test-all-agents.sh"
echo "  6. Start dashboard: cd dashboard && pnpm dev"
