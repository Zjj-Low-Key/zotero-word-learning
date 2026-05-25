#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -e "console.log(require('./manifest.json').version)")
mkdir -p dist
rm -rf dist/xpi-root
rm -f dist/*.xpi dist/*.zip

zip -r "dist/zotero-word-learning-${VERSION}.xpi" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  word-learning.ftl \
  chrome/icons/theme-sun.png \
  chrome/icons/theme-moon.png \
  -x "*.DS_Store" "._*"

echo "Built dist/zotero-word-learning-${VERSION}.xpi"

zip -r "dist/Word Learning ${VERSION} source no README.zip" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  word-learning.ftl \
  chrome/icons/theme-sun.png \
  chrome/icons/theme-moon.png \
  -x "*.DS_Store" "._*"

echo "Built dist/Word Learning ${VERSION} source no README.zip"

rm -f dist/._*
