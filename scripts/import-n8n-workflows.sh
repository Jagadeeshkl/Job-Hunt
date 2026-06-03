#!/usr/bin/env bash
# Import all n8n workflows via n8n REST API
# Run AFTER starting n8n and setting N8N_API_KEY in .env.local
# Usage: bash scripts/import-n8n-workflows.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
fi

N8N_URL="${N8N_BASE_URL:-http://localhost:5678}"
API_KEY="${N8N_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ N8N_API_KEY is not set in .env.local"
  echo "   Go to n8n → Settings → API → Create Key, then add it to .env.local"
  exit 1
fi

echo "🔄 Importing n8n workflows to $N8N_URL..."

for file in "$PROJECT_DIR/n8n-workflows"/*.json; do
  name=$(basename "$file")
  echo "   Importing $name..."
  response=$(curl -s -w "\n%{http_code}" -X POST "$N8N_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$file")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    workflow_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   ✅ $name imported (id: $workflow_id)"

    # Activate the workflow
    if [ -n "$workflow_id" ]; then
      curl -s -X PATCH "$N8N_URL/api/v1/workflows/$workflow_id/activate" \
        -H "X-N8N-API-KEY: $API_KEY" > /dev/null
      echo "   ✅ $name activated"
    fi
  else
    echo "   ⚠️  $name: HTTP $http_code"
    echo "      $body" | head -c 300
  fi
  echo ""
done

echo "✅ All workflows imported and activated."
