# QUEST Timetable System - Complete Deployment Guide

**Last Updated:** March 10, 2026  
**Developer:** Prof. Dr. Riaz Bhanbhro  
**Server:** Contabo VPS (194.60.87.212)  
**Project Path:** `/www/wwwroot/timetable`  
**Git Repository:** https://github.com/riabha/t

---

## 🔐 CRITICAL SETTINGS - SAVE THIS INFORMATION

### Database Configuration
- **Type:** PostgreSQL 15-alpine
- **Container Name:** `tt-postgres`
- **Database Name:** `timetable_db`
- **Username:** `timetable_user`
- **Password:** `TimeTable2025`
- **Port:** 5432 (internal only)
- **Volume:** `timetable_postgres_data` ⚠️ **THIS CONTAINS ALL YOUR DATA!**
- **Volume Location:** `/var/lib/docker/volumes/timetable_postgres_data/_data`

### Backend Configuration
- **Container Name:** `tt-backend`
- **Port:** 8000 (internal only)
- **Framework:** Python FastAPI + Uvicorn
- **Database URL:** `postgresql://timetable_user:TimeTable2025@db:5432/timetable_db`
- **Secret Key:** `TimeTable2025`
- **Environment:** `production`

### Frontend Configuration
- **Container Name:** `tt-frontend`
- **External Port:** 3100 (can be changed to 80)
- **Internal Port:** 80
- **Framework:** React + Vite + Nginx
- **Build:** Static files served by Nginx

### Network Configuration
- **Network Name:** `timetable-network`
- **Driver:** bridge
- **Frontend URL:** http://194.60.87.212:3100
- **Backend API:** http://localhost:8000 (internal only)

---

## 📁 IMPORTANT FILES LOCATIONS

### Environment File (`.env`)
**Location:** `/www/wwwroot/timetable/.env`

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@tt-postgres:5432/timetable
DB_PASSWORD=TimeTable2025

# Backend Configuration
SECRET_KEY=TimeTable2025

# Environment
ENVIRONMENT=production
```

### Docker Compose Files
1. **Production (CURRENT):** `/www/wwwroot/timetable/docker-compose.yml`
2. **Production Backup:** `/www/wwwroot/timetable/docker-compose.prod.yml`
3. **SSL Version:** `/www/wwwroot/timetable/docker-compose.ssl.yml`

### Current docker-compose.yml Structure
```yaml
services:
  db:
    image: postgres:15-alpine
    container_name: tt-postgres
    environment:
      POSTGRES_USER: timetable_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: timetable_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - timetable-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U timetable_user -d timetable_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: tt-backend
    environment:
      - DATABASE_URL=postgresql://timetable_user:${DB_PASSWORD}@db:5432/timetable_db
      - SECRET_KEY=${SECRET_KEY}
      - ENVIRONMENT=production
    depends_on:
      db:
        condition: service_healthy
    networks:
      - timetable-network

  frontend:
    build: ./frontend
    container_name: tt-frontend
    ports:
      - "3100:80"
    depends_on:
      - backend
    networks:
      - timetable-network

volumes:
  postgres_data:

networks:
  timetable-network:
    driver: bridge
```

---

## 🚀 DEPLOYMENT COMMANDS

### ✅ SAFE: Initial Setup (First Time Only)
```bash
cd /www/wwwroot/timetable
git pull origin main
docker-compose up -d --build
docker-compose ps
docker-compose logs -f
```

### ✅ SAFE: Regular Updates (Code Changes)
```bash
cd /www/wwwroot/timetable
git pull origin main
docker-compose down
docker-compose up -d
docker-compose ps
```

### ✅ SAFE: Restart All Services
```bash
cd /www/wwwroot/timetable
docker-compose restart
docker-compose ps
```

### ✅ SAFE: Restart Individual Service
```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart db
```

### ⚠️ DANGEROUS: Commands to NEVER Use
```bash
# ❌ NEVER - Deletes database volume with all data
docker-compose down -v

# ❌ NEVER for updates - Can cause database issues
docker-compose up -d --build

# ❌ NEVER - Removes all volumes
docker volume prune

# ❌ NEVER - Removes everything including data
docker system prune -a --volumes
```

---

## 🗄️ DATABASE BACKUP & RESTORE

### Create Backup Directory
```bash
mkdir -p /www/wwwroot/timetable/backups
chmod 755 /www/wwwroot/timetable/backups
```

### Backup Database (SQL Dump)
```bash
# Simple backup
docker exec tt-postgres pg_dump -U timetable_user -d timetable_db > /www/wwwroot/timetable/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup (recommended)
docker exec tt-postgres pg_dump -U timetable_user -d timetable_db | gzip > /www/wwwroot/timetable/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz

# List all backups
ls -lh /www/wwwroot/timetable/backups/
```

### Restore Database from SQL Dump
```bash
# Restore from uncompressed backup
docker exec -i tt-postgres psql -U timetable_user -d timetable_db < /www/wwwroot/timetable/backups/backup_20260310_153000.sql

# Restore from compressed backup
gunzip < /www/wwwroot/timetable/backups/backup_20260310_153000.sql.gz | docker exec -i tt-postgres psql -U timetable_user -d timetable_db
```

### Backup Complete Docker Volume
```bash
# Stop containers first
cd /www/wwwroot/timetable
docker-compose down

# Backup entire volume
docker run --rm \
  -v timetable_postgres_data:/data \
  -v /www/wwwroot/timetable/backups:/backup \
  alpine tar czf /backup/postgres_volume_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Start containers
docker-compose up -d
```

### Restore Complete Docker Volume
```bash
# Stop containers
cd /www/wwwroot/timetable
docker-compose down

# Restore volume
docker run --rm \
  -v timetable_postgres_data:/data \
  -v /www/wwwroot/timetable/backups:/backup \
  alpine tar xzf /backup/postgres_volume_20260310_153000.tar.gz -C /data

# Start containers
docker-compose up -d
```

### Automated Daily Backup Script
Create file: `/www/wwwroot/timetable/backup_daily.sh`
```bash
#!/bin/bash
BACKUP_DIR="/www/wwwroot/timetable/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
docker exec tt-postgres pg_dump -U timetable_user -d timetable_db | gzip > $BACKUP_DIR/daily_backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "daily_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: daily_backup_$DATE.sql.gz"
```

Make executable and add to crontab:
```bash
chmod +x /www/wwwroot/timetable/backup_daily.sh

# Add to crontab (runs daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /www/wwwroot/timetable/backup_daily.sh >> /www/wwwroot/timetable/backup.log 2>&1
```

---

## 🔧 TROUBLESHOOTING GUIDE

### Problem: Backend Not Starting

**Check logs:**
```bash
docker-compose logs backend --tail=50
```

**Common causes and solutions:**

1. **Database connection failed**
   ```bash
   # Check DATABASE_URL in docker-compose.yml
   grep DATABASE_URL docker-compose.yml
   
   # Should be: postgresql://timetable_user:TimeTable2025@db:5432/timetable_db
   ```

2. **Port 8000 already in use**
   ```bash
   # Find what's using the port
   lsof -ti:8000
   
   # Kill the process
   lsof -ti:8000 | xargs kill -9
   ```

3. **Database not ready**
   ```bash
   # Check database health
   docker exec tt-postgres pg_isready -U timetable_user -d timetable_db
   
   # Restart backend after database is healthy
   docker-compose restart backend
   ```

**Solution:**
```bash
docker-compose restart backend
docker-compose logs backend -f
```

### Problem: Frontend Not Accessible

**Check status:**
```bash
docker-compose ps
curl http://localhost:3100
```

**Common causes:**

1. **Port 3100 in use**
   ```bash
   netstat -tulpn | grep 3100
   lsof -ti:3100 | xargs kill -9
   ```

2. **Nginx configuration error**
   ```bash
   docker-compose logs frontend --tail=50
   ```

**Solution:**
```bash
docker-compose restart frontend
```

### Problem: Database Connection Issues

**Test connection:**
```bash
# Check if database is running
docker-compose ps

# Test connection
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "SELECT version();"

# Check if tables exist
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "\dt"

# Count records
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "SELECT COUNT(*) FROM teachers;"
```

**Solution:**
```bash
# Restart database
docker-compose restart db

# Wait for health check
sleep 10

# Restart backend
docker-compose restart backend
```

### Problem: Port 80 Already in Use

**Find and stop the service:**
```bash
# Find what's using port 80
lsof -ti:80

# Usually it's nginx
systemctl stop nginx
systemctl disable nginx

# Or kill the process
lsof -ti:80 | xargs kill -9
```

**Change frontend to port 80:**
```bash
cd /www/wwwroot/timetable
docker-compose down
sed -i 's|3100:80|80:80|g' docker-compose.yml
docker-compose up -d
```

### Problem: "Site Cannot Be Reached"

**Check all services:**
```bash
docker-compose ps
docker-compose logs --tail=100
```

**Check firewall:**
```bash
# Check if port is open
ufw status
ufw allow 3100/tcp
ufw allow 80/tcp
```

**Check if services are responding:**
```bash
curl http://localhost:8000/docs  # Backend
curl http://localhost:3100        # Frontend
```

### Complete System Reset (Preserves Data)

```bash
cd /www/wwwroot/timetable

# Stop everything
docker-compose down

# Remove containers (keeps volumes)
docker rm -f tt-backend tt-frontend tt-postgres

# Start fresh
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

---

## 📊 MONITORING & MAINTENANCE

### Check Container Status
```bash
# List all containers
docker-compose ps

# Detailed status
docker ps -a

# Check specific container
docker inspect tt-backend
docker inspect tt-postgres
docker inspect tt-frontend
```

### View Logs
```bash
# All services (follow mode)
docker-compose logs -f

# Specific service
docker-compose logs backend -f
docker-compose logs frontend -f
docker-compose logs db -f

# Last N lines
docker-compose logs --tail=50
docker-compose logs backend --tail=100

# Logs since specific time
docker-compose logs --since 1h
docker-compose logs --since "2026-03-10T10:00:00"
```

### Check System Resources
```bash
# Docker stats (real-time)
docker stats

# Disk usage
df -h
docker system df

# Container resource usage
docker stats tt-backend tt-frontend tt-postgres

# Memory usage
free -h

# CPU usage
top
```

### Check Application Health
```bash
# Backend health
curl http://localhost:8000/docs
curl http://localhost:8000/health

# Frontend health
curl http://localhost:3100

# Database health
docker exec tt-postgres pg_isready -U timetable_user -d timetable_db

# Database size
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "SELECT pg_size_pretty(pg_database_size('timetable_db'));"

# Table sizes
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Clean Up Docker (When Disk Space Low)
```bash
# Remove unused images
docker image prune -a

# Remove stopped containers
docker container prune

# Remove unused networks
docker network prune

# ⚠️ NEVER use this (removes volumes):
# docker volume prune
```

---

## 🔄 GIT WORKFLOW

### Pull Latest Changes
```bash
cd /www/wwwroot/timetable

# Check current status
git status

# Stash local changes if any
git stash

# Pull latest
git pull origin main

# Apply stashed changes
git stash pop

# If conflicts, resolve manually
```

### Push Changes to Repository
```bash
cd /www/wwwroot/timetable

# Check what changed
git status
git diff

# Add specific files
git add frontend/src/pages/AboutPage.jsx
git add DEPLOYMENT_SAFE_SETTINGS.md

# Or add all changes
git add .

# Commit with message
git commit -m "Enhanced About page with setup guide and FAQ"

# Push to repository
git push origin main
```

### View Git History
```bash
# Recent commits
git log --oneline -10

# Changes in specific file
git log --follow frontend/src/pages/AboutPage.jsx

# Show specific commit
git show <commit-hash>
```

---

## 🌐 NETWORK & ACCESS CONFIGURATION

### Current Network Setup
- **Frontend External:** Port 3100 → Internal Port 80
- **Backend Internal:** Port 8000 (not exposed)
- **Database Internal:** Port 5432 (not exposed)
- **Docker Network:** `timetable-network` (bridge mode)

### Access URLs
- **Public Website:** http://194.60.87.212:3100
- **API Documentation:** http://194.60.87.212:3100/api/docs
- **Backend Direct:** http://localhost:8000 (server only)
- **Database:** localhost:5432 (server only)

### Change Frontend Port to 80
```bash
cd /www/wwwroot/timetable

# Stop services
docker-compose down

# Edit port mapping
sed -i 's|"3100:80"|"80:80"|g' docker-compose.yml

# Verify change
grep "80:80" docker-compose.yml

# Start services
docker-compose up -d

# New URL: http://194.60.87.212
```

### Setup Domain Name (Optional)
If you have a domain (e.g., timetable.quest.edu.pk):

1. **Add DNS A Record:**
   - Point domain to: 194.60.87.212

2. **Update Nginx Configuration:**
   ```bash
   # Edit frontend nginx config
   nano frontend/nginx.conf
   
   # Add server_name directive
   server {
       listen 80;
       server_name timetable.quest.edu.pk;
       ...
   }
   ```

3. **Rebuild Frontend:**
   ```bash
   docker-compose down
   docker-compose up -d --build frontend
   ```

---

## 📅 MAINTENANCE SCHEDULE

### Daily Tasks
```bash
# Check container status
docker-compose ps

# Check for errors in logs
docker-compose logs --tail=100 | grep -i error

# Check disk space
df -h
```

### Weekly Tasks
```bash
# Backup database
docker exec tt-postgres pg_dump -U timetable_user -d timetable_db | gzip > /www/wwwroot/timetable/backups/weekly_backup_$(date +%Y%m%d).sql.gz

# Check disk usage
docker system df

# Review logs for issues
docker-compose logs --since 7d > /www/wwwroot/timetable/logs/weekly_$(date +%Y%m%d).log
```

### Monthly Tasks
```bash
# Update system packages
apt update
apt upgrade -y

# Clean old Docker images (if disk space low)
docker image prune -a

# Test backup restore procedure
# (Use a test environment, not production!)

# Review and rotate logs
find /www/wwwroot/timetable/logs -name "*.log" -mtime +30 -delete
```

---

## 🆘 EMERGENCY PROCEDURES

### Complete Data Loss Recovery

If database is completely lost:

1. **Check if volume still exists:**
   ```bash
   docker volume ls | grep timetable_postgres_data
   ```

2. **If volume exists, restore it:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **If volume is gone, restore from backup:**
   ```bash
   # Find latest backup
   ls -lht /www/wwwroot/timetable/backups/ | head -5
   
   # Restore from backup
   docker-compose down
   docker volume create timetable_postgres_data
   docker-compose up -d db
   sleep 10
   gunzip < /www/wwwroot/timetable/backups/backup_LATEST.sql.gz | docker exec -i tt-postgres psql -U timetable_user -d timetable_db
   docker-compose up -d
   ```

### System Completely Broken

Start from scratch (preserves data if volume exists):

```bash
cd /www/wwwroot/timetable

# Stop everything
docker-compose down

# Remove all containers
docker rm -f $(docker ps -aq)

# Pull latest code
git stash
git pull origin main

# Use production config
cp docker-compose.prod.yml docker-compose.yml

# Start fresh
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

---

## 📝 IMPORTANT NOTES & WARNINGS

### Critical Rules
1. ⚠️ **NEVER use `docker-compose down -v`** - Deletes database volume!
2. ⚠️ **NEVER use `docker-compose up -d --build`** for updates - Can cause issues!
3. ✅ **ALWAYS backup before major changes**
4. ✅ **Test changes in development first**
5. ✅ **Keep this document updated**

### Data Locations
- **Database Volume:** `timetable_postgres_data`
- **Physical Location:** `/var/lib/docker/volumes/timetable_postgres_data/_data`
- **Backups:** `/www/wwwroot/timetable/backups/`
- **Logs:** `/www/wwwroot/timetable/logs/`

### Passwords & Secrets
- **Database Password:** `TimeTable2025`
- **Secret Key:** `TimeTable2025`
- **Database User:** `timetable_user`
- **Database Name:** `timetable_db`

### Container Names
- **Database:** `tt-postgres`
- **Backend:** `tt-backend`
- **Frontend:** `tt-frontend`

### Ports
- **Frontend:** 3100 (external) → 80 (internal)
- **Backend:** 8000 (internal only)
- **Database:** 5432 (internal only)

---

## 📞 SUPPORT & CONTACTS

### Developer
- **Name:** Prof. Dr. Riaz Bhanbhro
- **Department:** Civil Engineering, QUEST
- **Email:** [Contact through university]

### Server Provider
- **Provider:** Contabo
- **Server IP:** 194.60.87.212
- **Control Panel:** [Contabo Customer Portal]

### Resources
- **Git Repository:** https://github.com/riabha/t
- **Documentation:** This file
- **User Manual:** `Timetable_User_Manual.tex`
- **Research Paper:** `Timetable_Research_Paper.tex`

---

## 🎓 ADDITIONAL DOCUMENTATION

### Related Files
1. **User Manual:** `Timetable_User_Manual.tex` - Complete guide for end users
2. **Research Paper:** `Timetable_Research_Paper.tex` - Technical documentation
3. **Deployment Guide:** `DEPLOYMENT_GUIDE.md` - Server setup instructions
4. **API Documentation:** http://194.60.87.212:3100/api/docs - Interactive API docs

### Quick Reference Commands
```bash
# Navigate to project
cd /www/wwwroot/timetable

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart all
docker-compose restart

# Backup database
docker exec tt-postgres pg_dump -U timetable_user -d timetable_db | gzip > backups/backup_$(date +%Y%m%d).sql.gz

# Update from git
git pull origin main && docker-compose down && docker-compose up -d
```

---

**END OF COMPLETE DEPLOYMENT GUIDE**

**Last Updated:** March 10, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅

Keep this document safe and updated. It contains all critical information for deploying and maintaining the QUEST Timetable System.
