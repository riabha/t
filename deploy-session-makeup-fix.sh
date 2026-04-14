#!/bin/bash
# Deployment script for assignment session and makeup system fixes
# Run this on your Contabo server

set -e  # Exit on error

echo "=========================================="
echo "  Assignment Session & Makeup System Fix"
echo "=========================================="
echo ""

# Navigate to project directory
cd /www/wwwroot/timetable

echo "Step 1: Pulling latest changes from Git..."
git pull origin main

echo ""
echo "Step 2: Stopping containers..."
docker-compose down

echo ""
echo "Step 3: Rebuilding and starting containers..."
docker-compose up -d --build

echo ""
echo "Step 4: Waiting for containers to be ready..."
sleep 10

echo ""
echo "Step 5: Running database migration..."
docker exec tt-backend python migrations/add_makeup_system.py

echo ""
echo "Step 5: Waiting for services to start..."
sleep 15

echo ""
echo "Step 6: Checking container status..."
docker-compose ps

echo ""
echo "Step 7: Checking backend logs..."
docker-compose logs backend --tail=20

echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Frontend: http://194.60.87.212:3100"
echo "📚 Backend API: http://194.60.87.212:3100/api/docs"
echo ""
echo "✨ Fixed Issues:"
echo "  1. Sessions now visible immediately after creation"
echo "  2. Duplicate session names allowed (auto-suffix: -1, -2, etc.)"
echo "  3. Makeup system database schema created"
echo "  4. Separate solver copied for makeup classes"
echo ""
echo "🎯 New Features:"
echo "  - Create 'Even 2026' multiple times"
echo "  - Sessions visible without assignments"
echo "  - Makeup system foundation ready"
echo "  - 5 new database tables for makeup tracking"
echo ""
echo "📝 Next Steps:"
echo "  - Test creating duplicate sessions"
echo "  - Verify all sessions are visible"
echo "  - Ready for makeup system frontend development"
echo ""
