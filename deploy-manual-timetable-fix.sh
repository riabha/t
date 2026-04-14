#!/bin/bash
# Quick deployment script for manual timetable fixes
# Run this on your Contabo server

set -e  # Exit on error

echo "=========================================="
echo "  Manual Timetable Fixes - Deployment"
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
echo "Step 4: Waiting for services to start..."
sleep 15

echo ""
echo "Step 5: Checking container status..."
docker-compose ps

echo ""
echo "Step 6: Checking backend logs..."
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
echo "  1. Manual timetables now save and appear immediately"
echo "  2. Friday break configuration is respected"
echo "  3. 'Save as Latest' makes timetables visible"
echo "  4. Manual timetables visible in all lists"
echo ""
echo "🎯 New Feature:"
echo "  - Friday Break Toggle button in Manual Editor"
echo ""
