#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -e "console.log(require('./manifest.json').version)")
mkdir -p dist
rm -f "dist/zotero-word-learning-${VERSION}.xpi"

zip -r "dist/zotero-word-learning-${VERSION}.xpi" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  -x "*.DS_Store"

echo "Built dist/zotero-word-learning-${VERSION}.xpi"
