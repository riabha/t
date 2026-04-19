#!/bin/bash

# Deployment script for Sequential Batch Generation Fix
# Fixes batch 23 INFEASIBLE error after batch 22 succeeds

echo "=========================================="
echo "Sequential Batch Generation Fix"
echo "=========================================="
echo ""
echo "This fix resolves the issue where batch 22 generates"
echo "successfully but batch 23 fails with INFEASIBLE error"
echo "in sequential mode."
echo ""
echo "Root Cause: Existing slots from batch 22 were not being"
echo "loaded as constraints for batch 23, causing the solver"
echo "to try using the same time slots twice."
echo ""
echo "Fix: Modified solver.py to properly load existing slots"
echo "from the target timetable in incremental mode."
echo ""
echo "=========================================="
echo ""

read -p "Press Enter to start deployment..."

echo ""
echo "Step 1: Navigating to project directory..."
cd /www/wwwroot/timetable || exit 1
echo "✓ Current directory: $(pwd)"

echo ""
echo "Step 2: Checking current git status..."
git status

echo ""
echo "Step 3: Pulling latest changes from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed. Trying to reset..."
    git fetch origin
    git reset --hard origin/main
fi

echo ""
echo "Step 4: Verifying the fix is present..."
if grep -q "INCREMENTAL MODE" backend/solver.py; then
    echo "✓ Fix verified: INCREMENTAL MODE logic found in solver.py"
else
    echo "❌ WARNING: Fix not found in solver.py"
    echo "   Please verify the changes were committed and pushed"
    exit 1
fi

echo ""
echo "Step 5: Stopping containers..."
docker-compose down

echo ""
echo "Step 6: Rebuilding and starting containers..."
docker-compose up -d --build

echo ""
echo "Step 7: Waiting for services to start (15 seconds)..."
sleep 15

echo ""
echo "Step 8: Checking container status..."
docker-compose ps

echo ""
echo "Step 9: Checking backend logs for errors..."
docker-compose logs backend --tail=30

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Go to the Timetable Generation page"
echo "2. Select Sequential Mode"
echo "3. Select batches 22 and 23"
echo "4. Click Generate"
echo "5. Watch for these log messages:"
echo "   [INCREMENTAL MODE] Loading existing slots from timetable ID XXX"
echo "   [INCREMENTAL MODE] Loaded XXX existing slots as constraints"
echo ""
echo "Expected Result:"
echo "✓ Batch 22 generates successfully"
echo "✓ Batch 23 generates successfully (no more INFEASIBLE)"
echo ""
echo "If batch 23 still fails, check:"
echo "- Teacher restrictions (too many restricted slots)"
echo "- Lab room availability"
echo "- Total contact hours vs available slots"
echo ""
echo "=========================================="
