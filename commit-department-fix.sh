#!/bin/bash
# Git commit script for department creation fix

echo "Committing department creation fix..."

# Add all changed files
git add frontend/Dockerfile
git add frontend/src/pages/DepartmentsPage.jsx
git add backend/routers/departments.py
git add fix_department_sequence.sh
git add deploy-fix-departments.sh
git add commit-department-fix.sh

# Create commit with detailed message
git commit -m "Fix: Department creation issue

Changes:
- Fixed nginx proxy configuration in frontend Dockerfile (added trailing slash)
- Improved error handling in DepartmentsPage.jsx with console logging
- Added duplicate check and better error messages in departments router
- Added sequence check endpoint for debugging
- Created fix_department_sequence.sh script to fix database sequences
- Created deployment script for easy updates

This fix addresses:
1. Nginx proxy routing issues
2. Database sequence synchronization
3. Better error reporting for debugging
4. Duplicate department code validation"

echo ""
echo "Commit created successfully!"
echo ""
echo "To push to GitHub, run:"
echo "  git push origin main"
echo ""
