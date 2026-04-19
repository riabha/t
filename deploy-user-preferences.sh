#!/bin/bash
# Deploy user preferences feature

echo "🚀 Deploying user preferences feature..."

cd /www/wwwroot/timetable

echo "📥 Pulling latest code..."
git pull origin main

echo "🗄️ Running migration..."
docker exec tt-backend python migrations/add_user_preferences.py

echo "🔄 Rebuilding containers..."
docker-compose down
docker-compose up -d --build

echo "⏳ Waiting for services to start..."
sleep 20

echo "✅ Deployment complete!"
docker-compose ps
