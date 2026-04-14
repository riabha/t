#!/bin/bash
# Check current status and provide fix options

echo "=========================================="
echo "  System Status Check"
echo "=========================================="
echo ""

cd /www/wwwroot/timetable

echo "1. Checking container status..."
docker-compose ps
echo ""

echo "2. Checking backend logs (last 50 lines)..."
docker-compose logs backend --tail=50
echo ""

echo "3. Testing if backend API is responding..."
curl -s http://localhost:8000/api/departments/ | head -20
echo ""

echo "=========================================="
echo "  Fix Options"
echo "=========================================="
echo ""
echo "Option 1: Try restarting containers"
echo "  docker-compose restart"
echo ""
echo "Option 2: Rebuild containers"
echo "  docker-compose down && docker-compose up -d --build"
echo ""
echo "Option 3: Rollback to previous working version"
echo "  bash ROLLBACK_TO_WORKING.sh"
echo ""
echo "Option 4: Check database"
echo "  docker exec tt-postgres psql -U timetable_user -d timetable_db -c '\dt'"
echo ""
