#!/bin/bash
# Deployment script for department creation fix
# This script will deploy the updated frontend and backend

set -e  # Exit on error

echo "=========================================="
echo "  Department Creation Fix - Deployment"
echo "=========================================="
echo ""

# Navigate to project directory
cd /www/wwwroot/timetable

echo "Step 1: Pulling latest changes from Git..."
git pull origin main

echo ""
echo "Step 2: Fixing database sequences..."
docker exec tt-backend python fix_sequences.py

echo ""
echo "Step 3: Rebuilding and restarting containers..."
docker-compose down
docker-compose up -d --build

echo ""
echo "Step 4: Waiting for services to start..."
sleep 10

echo ""
echo "Step 5: Checking container status..."
docker-compose ps

echo ""
echo "Step 6: Checking backend logs..."
docker-compose logs backend --tail=20

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Frontend: http://194.60.87.212:3100"
echo "Backend API: http://194.60.87.212:3100/api/docs"
echo ""
echo "You can now create new departments!"
echo ""
