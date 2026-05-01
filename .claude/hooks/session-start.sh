#!/bin/bash
set -euo pipefail

# Only run in remote (cloud) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install Python dependencies for fetch pipeline
cd "$CLAUDE_PROJECT_DIR/fetch"
uv sync

# Install Node dependencies for gallery
cd "$CLAUDE_PROJECT_DIR/gallery"
npm install

# Install Playwright Chromium browser
npx playwright install chromium
