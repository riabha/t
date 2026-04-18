#!/bin/bash
# Simple deployment script with error visibility

echo "🚀 Starting deployment..."
echo ""

cd /www/wwwroot/timetable || exit 1

echo "📥 Pulling latest code from GitHub..."
git pull origin main || { echo "❌ Git pull failed"; exit 1; }
echo ""

echo "🛑 Stopping containers..."
docker-compose down || { echo "❌ Failed to stop containers"; exit 1; }
echo ""

echo "🔨 Building and starting containers..."
docker-compose up -d --build || { echo "❌ Failed to build/start containers"; exit 1; }
echo ""

echo "⏳ Waiting for services to be ready..."
sleep 20
echo ""

echo "📊 Container status:"
docker-compose ps
echo ""

echo "📋 Recent backend logs (last 50 lines):"
docker logs tt-backend --tail 50
echo ""

echo "✅ Deployment complete!"
echo ""
echo "💡 To view live logs, run:"
echo "   docker logs -f tt-backend"
