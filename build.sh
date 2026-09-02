#!/bin/bash
set -e

if [ ! -f .env ]; then
  echo "Error: .env file not found"
  exit 1
fi

echo "Building Next.js..."
pnpm prepare:maplibre-worker
pnpm prepare:p5-runtime
pnpm build

if [ ! -d .next/standalone ]; then
  echo "Error: Build failed - .next/standalone not found"
  exit 1
fi

echo "Build complete. Run 'docker build -t geul-web .' to build the container image."
