#!/bin/bash

# Sequential Batch-wise Generation Deployment Script
# This script deploys the new sequential batch generation feature

echo "=========================================="
echo "Sequential Batch Generation Deployment"
echo "=========================================="
echo ""

# Navigate to project directory
cd /www/wwwroot/timetable || exit 1

# Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin main

# Check if pull was successful
if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi

echo "✓ Git pull successful"
echo ""

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down

echo "✓ Containers stopped"
echo ""

# Rebuild and start containers
echo "🔨 Building and starting containers..."
docker-compose up -d --build

# Wait for containers to be healthy
echo ""
echo "⏳ Waiting for containers to be ready..."
sleep 20

# Check container status
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "New Features:"
echo "  • Sequential batch-wise generation"
echo "  • Process batches one by one (22 → 23 → 24)"
echo "  • Reduces solver complexity"
echo "  • Higher success rate for complex scenarios"
echo ""
echo "Usage:"
echo "  1. Select 2+ batches in Timetable page"
echo "  2. Enable 'Sequential Batch-wise Generation' toggle"
echo "  3. Click Generate"
echo ""
echo "Documentation: SEQUENTIAL_BATCH_GENERATION.md"
echo ""
