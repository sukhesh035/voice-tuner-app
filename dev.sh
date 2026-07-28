#!/usr/bin/env bash
set -e

cleanup() {
  echo ""
  echo "Shutting down..."
  kill -- -$$ 2>/dev/null || true
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:4200 | xargs kill -9 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "Killing processes on ports 3000 and 4200..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4200 | xargs kill -9 2>/dev/null || true

echo "Starting backend API..."
pnpm dev:api &
API_PID=$!

echo "Starting mobile UI..."
pnpm dev:ui &
UI_PID=$!

echo ""
echo "  API  -> http://localhost:3000"
echo "  UI   -> http://localhost:4200"
echo "  Press Ctrl+C to stop both"
echo ""

wait $API_PID $UI_PID 2>/dev/null