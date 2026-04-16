#!/bin/bash

# Per-Teacher Restriction Mode Deployment Script
# This script deploys the new per-teacher restriction mode feature

echo "=========================================="
echo "Per-Teacher Restriction Mode Deployment"
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

# Run migration
echo ""
echo "🔄 Running database migration..."
docker exec tt-backend python migrations/add_teacher_restriction_mode.py

# Check migration status
if [ $? -ne 0 ]; then
    echo "⚠️  Migration failed or already applied"
else
    echo "✓ Migration completed successfully"
fi

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
echo "  • Per-teacher restriction mode (Strict/Preferred)"
echo "  • Each teacher can have individual enforcement level"
echo "  • Strict = Absolute blocks (solver fails before using)"
echo "  • Preferred = Soft constraints (solver avoids but can use)"
echo ""
echo "Usage:"
echo "  1. Go to Restrictions page"
echo "  2. Select a teacher"
echo "  3. Toggle between Strict/Preferred mode"
echo "  4. Set restrictions as usual"
echo "  5. Save"
echo ""
echo "Icons in teacher dropdown:"
echo "  🔒 = Strict mode"
echo "  💡 = Preferred mode"
echo ""
