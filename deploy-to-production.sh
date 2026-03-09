#!/bin/bash
# Quick deployment script for QUEST Timetable to production server
# Usage: ./deploy-to-production.sh

echo "========================================"
echo "  QUEST Timetable - Deploy to Production"
echo "========================================"
echo ""

SERVER="root@194.60.87.212"
PROJECT_PATH="/www/wwwroot/timetable"

echo "Deploying to: $SERVER"
echo "Project path: $PROJECT_PATH"
echo ""

echo "Connecting to server..."
echo ""

# Execute deployment
ssh $SERVER << 'ENDSSH'
cd /www/wwwroot/timetable
git pull
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "Application is now running at:"
echo "  - http://194.60.87.212:3100"
echo "  - http://t-table.quest"
echo ""
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  ✅ Deployment Successful!"
    echo "========================================"
    echo ""
    echo "Your application is now live!"
    echo ""
else
    echo ""
    echo "========================================"
    echo "  ❌ Deployment Failed!"
    echo "========================================"
    echo ""
    echo "Please check the error messages above."
    echo ""
fi
