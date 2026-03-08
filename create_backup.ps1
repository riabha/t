# Create comprehensive backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "_backups/backup_$timestamp"

Write-Host "Creating backup directory: $backupDir"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host "Backing up critical files..."

# Backend files
Copy-Item "backend/solver.py" "$backupDir/solver.py" -Force
Copy-Item "backend/models.py" "$backupDir/models.py" -Force
Copy-Item "backend/database.py" "$backupDir/database.py" -Force -ErrorAction SilentlyContinue

# Database
if (Test-Path "backend/timetable.db") {
    Copy-Item "backend/timetable.db" "$backupDir/timetable.db" -Force
    Write-Host "  - Database backed up"
}

# Frontend files
Copy-Item "frontend/src/pages/LabSettingsPage.jsx" "$backupDir/LabSettingsPage.jsx" -Force
Copy-Item "frontend/src/App.jsx" "$backupDir/App.jsx" -Force -ErrorAction SilentlyContinue
Copy-Item "frontend/src/layouts/DashboardLayout.jsx" "$backupDir/DashboardLayout.jsx" -Force -ErrorAction SilentlyContinue

# Documentation
Copy-Item "TEACHER_RESTRICTION_FIX_COMPLETE.md" "$backupDir/" -Force
Copy-Item "DAY_BALANCING_FEATURE_COMPLETE.md" "$backupDir/" -Force
Copy-Item "LAB_SETTINGS_FINAL_DESIGN.md" "$backupDir/" -Force

Write-Host ""
Write-Host "==========================================="
Write-Host "BACKUP COMPLETE: $backupDir"
Write-Host "==========================================="
Write-Host ""
Write-Host "Backed up files:"
Get-ChildItem $backupDir | Format-Table Name, @{Label="Size (KB)"; Expression={[math]::Round($_.Length/1KB, 2)}} -AutoSize

Write-Host ""
Write-Host "To restore from this backup:"
Write-Host "  Copy-Item '$backupDir/*' -Destination . -Recurse -Force"
