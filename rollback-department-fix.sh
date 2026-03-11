#!/bin/bash
# Rollback script - reverts to previous version if deployment fails

set -e

echo "=========================================="
echo "  Rolling Back Department Fix"
echo "=========================================="
echo ""

cd /www/wwwroot/timetable

echo "Step 1: Getting current commit hash..."
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Current commit: $CURRENT_COMMIT"

echo ""
echo "Step 2: Reverting to previous commit..."
git reset --hard HEAD~1

echo ""
echo "Step 3: Rebuilding containers with previous version..."
docker-compose down
docker-compose up -d --build

echo ""
echo "Step 4: Checking status..."
docker-compose ps

echo ""
echo "=========================================="
echo "  Rollback Complete!"
echo "=========================================="
echo ""
echo "Previous commit restored: $CURRENT_COMMIT"
echo ""
echo "To return to the latest version, run:"
echo "  git reset --hard $CURRENT_COMMIT"
echo "  docker-compose down && docker-compose up -d --build"
echo ""
