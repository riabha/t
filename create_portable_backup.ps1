# Create a portable backup with only essential files
# Excludes: node_modules, .venv, __pycache__, old backups, cache files

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "portable_backup_$timestamp"
$backupDir = $backupName

Write-Host "Creating portable backup: $backupName" -ForegroundColor Green
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Backend files
Write-Host "Copying backend files..." -ForegroundColor Cyan
$backendDir = "$backupDir/backend"
New-Item -ItemType Directory -Path $backendDir -Force | Out-Null

# Copy backend Python files
Copy-Item "backend/*.py" $backendDir -Force
Copy-Item "backend/timetable.db" $backupDir/backend/ -Force -ErrorAction SilentlyContinue

# Copy backend subdirectories (excluding __pycache__)
$backendSubdirs = @("routers", "migrations")
foreach ($dir in $backendSubdirs) {
    if (Test-Path "backend/$dir") {
        Copy-Item "backend/$dir" $backendDir -Recurse -Force -Exclude "__pycache__"
    }
}

# Copy backend config files
Copy-Item "backend/requirements.txt" $backendDir -Force -ErrorAction SilentlyContinue
Copy-Item "backend/.dockerignore" $backendDir -Force -ErrorAction SilentlyContinue
Copy-Item "backend/Dockerfile" $backendDir -Force -ErrorAction SilentlyContinue

# Frontend files
Write-Host "Copying frontend files..." -ForegroundColor Cyan
$frontendDir = "$backupDir/frontend"
New-Item -ItemType Directory -Path $frontendDir -Force | Out-Null

# Copy frontend source code
Copy-Item "frontend/src" $frontendDir -Recurse -Force
Copy-Item "frontend/public" $frontendDir -Recurse -Force

# Copy frontend config files
Copy-Item "frontend/package.json" $frontendDir -Force
Copy-Item "frontend/package-lock.json" $frontendDir -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/index.html" $frontendDir -Force
Copy-Item "frontend/vite.config.js" $frontendDir -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/tailwind.config.js" $frontendDir -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/postcss.config.js" $frontendDir -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/.dockerignore" $frontendDir -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/Dockerfile" $frontendDir -Force -ErrorAction SilentlyContinue

# Root files
Write-Host "Copying root configuration files..." -ForegroundColor Cyan
Copy-Item "docker-compose.yml" $backupDir -Force -ErrorAction SilentlyContinue
Copy-Item "README.md" $backupDir -Force -ErrorAction SilentlyContinue

# Copy documentation files
$docFiles = @(
    "CONSECUTIVE_LECTURES_COMPLETE.md",
    "AUTOMATIC_BREAK_CALCULATION_COMPLETE.md",
    "CONFIGURABLE_START_TIME_COMPLETE.md",
    "API_ENDPOINTS_REFERENCE.md"
)

foreach ($doc in $docFiles) {
    if (Test-Path $doc) {
        Copy-Item $doc $backupDir -Force
    }
}

# Create setup instructions
$setupInstructions = @"
# Portable Backup - Setup Instructions

This is a clean, portable backup of the Timetable Portal project.

## Prerequisites
- Python 3.8+ (with pip)
- Node.js 16+ (with npm)

## Setup on New Computer

### Backend Setup:
1. Navigate to backend folder:
   cd backend

2. Create virtual environment:
   python -m venv .venv

3. Activate virtual environment:
   - Windows: .venv\Scripts\activate
   - Linux/Mac: source .venv/bin/activate

4. Install dependencies:
   pip install -r requirements.txt

5. Run backend:
   python main.py

   Backend will run on: http://localhost:8000

### Frontend Setup:
1. Navigate to frontend folder:
   cd frontend

2. Install dependencies:
   npm install

3. Run frontend:
   npm run dev

   Frontend will run on: http://localhost:5173

## Database
- The timetable.db file is included with all your data
- No additional database setup needed

## Features Included
- Consecutive Lectures (NEW)
- Automatic Break Calculation
- Configurable Start Time
- Morning Lab Configuration
- Teacher Restrictions
- All existing functionality

## Notes
- node_modules and .venv are excluded (will be created during setup)
- All source code and database are included
- Docker files included for containerized deployment

Created: $timestamp
"@

Set-Content -Path "$backupDir/SETUP_INSTRUCTIONS.md" -Value $setupInstructions

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "PORTABLE BACKUP COMPLETE: $backupName" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup includes:" -ForegroundColor Yellow
Write-Host "  ✓ Backend source code (.py files)" -ForegroundColor White
Write-Host "  ✓ Frontend source code (src/)" -ForegroundColor White
Write-Host "  ✓ Database (timetable.db)" -ForegroundColor White
Write-Host "  ✓ Configuration files (package.json, requirements.txt)" -ForegroundColor White
Write-Host "  ✓ Documentation files" -ForegroundColor White
Write-Host "  ✓ Setup instructions" -ForegroundColor White
Write-Host ""
Write-Host "Excluded (will be recreated on new computer):" -ForegroundColor Yellow
Write-Host "  ✗ node_modules/" -ForegroundColor DarkGray
Write-Host "  ✗ .venv/" -ForegroundColor DarkGray
Write-Host "  ✗ __pycache__/" -ForegroundColor DarkGray
Write-Host "  ✗ Old backups" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To use on another computer:" -ForegroundColor Cyan
Write-Host "  1. Copy the '$backupName' folder to the new computer" -ForegroundColor White
Write-Host "  2. Read SETUP_INSTRUCTIONS.md in the backup folder" -ForegroundColor White
Write-Host "  3. Follow the setup steps for backend and frontend" -ForegroundColor White
Write-Host ""

# Calculate backup size
$backupSize = (Get-ChildItem -Path $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Backup size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green
