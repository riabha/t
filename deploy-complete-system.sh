#!/bin/bash
# Complete System Deployment Script
# Deploys: Manual timetables fix, Sessions fix, Students, Makeup system

set -e

echo "=========================================="
echo "  Complete System Deployment"
echo "=========================================="
echo ""
echo "This will deploy:"
echo "  ✓ Manual timetable fixes"
echo "  ✓ Assignment session fixes"
echo "  ✓ Student management system"
echo "  ✓ Makeup classes system"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

cd /www/wwwroot/timetable

echo ""
echo "Step 1: Pulling latest code from GitHub..."
git pull origin main

echo ""
echo "Step 2: Stopping containers..."
docker-compose down

echo ""
echo "Step 3: Rebuilding containers with new code..."
docker-compose up -d --build

echo ""
echo "Step 4: Waiting for services to start..."
sleep 20

echo ""
echo "Step 5: Checking container status..."
docker-compose ps

echo ""
echo "Step 6: Checking backend logs..."
docker-compose logs backend --tail=30

echo ""
echo "Step 7: Testing API endpoints..."
echo "Testing students API..."
curl -s http://localhost:8000/api/students/ > /dev/null && echo "  ✓ Students API working" || echo "  ✗ Students API failed"

echo "Testing makeup API..."
curl -s http://localhost:8000/api/makeup/ > /dev/null && echo "  ✓ Makeup API working" || echo "  ✗ Makeup API failed"

echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Access your system:"
echo "  Frontend: http://194.60.87.212:3100"
echo "  API Docs: http://194.60.87.212:3100/api/docs"
echo ""
echo "📋 New Features Available:"
echo "  • Students Management (/dashboard/students)"
echo "  • Makeup Classes (/dashboard/makeup)"
echo "  • Fixed Manual Timetables"
echo "  • Fixed Assignment Sessions"
echo ""
echo "🧪 Test Checklist:"
echo "  1. Login as admin"
echo "  2. Check 'Students' menu item"
echo "  3. Check 'Makeup Classes' menu item"
echo "  4. Create a test student"
echo "  5. Create a test makeup class"
echo "  6. Test CSV upload"
echo ""
echo "📚 Documentation:"
echo "  See COMPLETE_SYSTEM_DEPLOYMENT.md for full details"
echo ""
