#!/bin/bash

# Timetable System - Quick Deployment Script
# Run this on your Contabo server after cloning the repository

set -e

echo "🚀 Starting Timetable System Deployment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with your configuration."
    echo "Copy .env.example and fill in your values:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Stop existing containers if running
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build and start containers
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.prod.yml build

echo "🚀 Starting containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check container status
echo "📊 Container Status:"
docker ps --filter "name=tt-"

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📝 Next steps:"
echo "1. Initialize database: docker exec -it tt-backend python -c \"from database import engine, Base; from models import *; Base.metadata.create_all(bind=engine)\""
echo "2. Import data: docker cp backend/data_export.json tt-backend:/app/ && docker exec -it tt-backend python import_data.py"
echo "3. Configure reverse proxy in aaPanel"
echo "4. Enable SSL certificate"
echo ""
echo "🔍 View logs:"
echo "  docker logs tt-backend"
echo "  docker logs tt-frontend"
echo "  docker logs tt-postgres"
echo ""
echo "🌐 Application will be available at: http://localhost:8080"
