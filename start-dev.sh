#!/bin/bash

# AeroAgent Development Server Startup Script
# This script properly loads the environment and starts the dev server

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting AeroAgent Development Server..."
echo ""

# Load API key from .env.local
if [ -f .env.local ]; then
  export $(grep ANTHROPIC_API_KEY .env.local)
  echo "✓ API Key loaded from .env.local"
else
  echo "⚠️  .env.local not found in current directory"
  echo "Please create .env.local with ANTHROPIC_API_KEY=your_api_key"
  exit 1
fi

# Check if API key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY not set"
  exit 1
fi

echo "✓ Environment configured"
echo ""
echo "Starting server..."
echo "  URL: http://localhost:3000"
echo "  API: http://localhost:3000/api/claude"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Kill any existing process on port 3000
if lsof -i :3000 >/dev/null 2>&1; then
  echo "⚠️  Port 3000 already in use, terminating existing process..."
  kill $(lsof -i :3000 | grep LISTEN | awk '{print $2}') 2>/dev/null || true
  sleep 1
fi

# Start the development server
npm run dev
