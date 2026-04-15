#!/bin/bash
# Fix EAS build "Failed to resolve plugin" by clearing corrupted npm/npx cache
# Run: ./scripts/fix-eas-build.sh
# Then: eas build --profile production --platform ios

set -e
echo "Clearing npm cache..."
npm cache clean --force

echo "Clearing npx cache..."
rm -rf ~/.npm/_npx 2>/dev/null || true

echo ""
echo "Verifying expo config..."
cd "$(dirname "$0")/.."
if npx expo config --json > /dev/null 2>&1; then
  echo "✓ Config OK - you can now run: eas build --profile production --platform ios"
else
  echo "✗ Config still failing. Try:"
  echo "  1. Move project to path without spaces: mv \"$PWD\" ~/allergy-scanner"
  echo "  2. Run from new location: cd ~/allergy-scanner && eas build --profile production --platform ios"
fi
