#!/bin/bash
# Emergency Rollback Script
# Use this if the system is broken and you need to go back to working state

echo "=========================================="
echo "  EMERGENCY ROLLBACK"
echo "=========================================="
echo ""

cd /www/wwwroot/timetable

echo "Step 1: Finding last working commit..."
git log --oneline -10

echo ""
echo "Enter the commit hash BEFORE the makeup system changes (e.g., e5a2cb1):"
read COMMIT_HASH

if [ -z "$COMMIT_HASH" ]; then
    echo "No commit hash provided. Aborting."
    exit 1
fi

echo ""
echo "Step 2: Rolling back to commit $COMMIT_HASH..."
git reset --hard $COMMIT_HASH

echo ""
echo "Step 3: Stopping containers..."
docker-compose down

echo ""
echo "Step 4: Rebuilding with old code..."
docker-compose up -d --build

echo ""
echo "Step 5: Waiting for services..."
sleep 15

echo ""
echo "Step 6: Checking status..."
docker-compose ps

echo ""
echo "Step 7: Checking backend logs..."
docker-compose logs backend --tail=30

echo ""
echo "=========================================="
echo "  Rollback Complete"
echo "=========================================="
echo ""
echo "If backend is running, your system should be working again."
echo "The makeup system changes have been reverted."
echo ""
