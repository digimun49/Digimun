#!/bin/bash
set -e

echo "Post-merge setup: installing dependencies..."
npm install --prefer-offline --no-audit --no-fund 2>/dev/null || true

echo "Post-merge setup complete."
