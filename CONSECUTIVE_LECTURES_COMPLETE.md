# Consecutive Lectures Feature - Implementation Complete

## Overview
Implemented the ability to specify that subjects should have consecutive lectures (2 or 3 hours back-to-back) during timetable generation.

## Changes Made

### 1. Database Schema (backend/models.py)
- Added `consecutive_lectures` field to Assignment model
  - Type: Integer
  - Values: 0 (none), 2 (two consecutive), 3 (three consecutive)
  - Default: 0

### 2. API Schemas (backend/schemas.py)
- Updated `AssignmentCreate` to include `consecutive_lectures` field
- Updated `AssignmentUpdate` to include `consecutive_lectures` field
- Updated `AssignmentOut` to include `consecutive_lectures` field

### 3. Database Migration
- Created migration file: `backend/migrations/add_consecutive_lectures.py`
- Migration adds `consecutive_lectures` column to assignments table
- Migration executed successfully

### 4. Frontend UI (frontend/src/pages/AssignmentsPage.jsx)
- Added "Consecutive" dropdown in the Subject Assignment Modal
- Options: None, 2 Hours, 3 Hours
- Positioned as 4th column alongside Teacher, Lab Engineer, and Lab Room
- Updated grid from 3 columns to 4 columns
- Added consecutive_lectures to save API call

### 5. Solver Logic (backend/solver.py)
- Added consecutive lectures constraint enforcement
- Logic:
  - If consecutive_lectures = 0: Normal behavior (at most 1 slot per day)
  - If consecutive_lectures = 2: Enforces 2 consecutive slots on same day (e.g., slots 4-5, 1-2, 5-6)
  - If consecutive_lectures = 3: Enforces 3 consecutive slots on same day (e.g., slots 4-5-6, 0-1-2)
- Constraint ensures:
  - Slots must be truly consecutive (no gaps)
  - All consecutive slots must be on the same day
  - Exactly one consecutive group is used per day when classes are scheduled
- Does NOT span across break slots

## How It Works

### User Workflow:
1. Go to Assignments page
2. Click on a subject row to open the Edit Subject Assignments modal
3. For each section, select "Consecutive" dropdown
4. Choose: None, 2 Hours, or 3 Hours
5. Click "Save All Changes"
6. Generate timetable - solver will enforce consecutive slots

### Solver Behavior:
- For 2 consecutive: Finds valid pairs like (4,5), (1,2), (5,6), (0,1)
- For 3 consecutive: Finds valid triplets like (4,5,6), (0,1,2), (5,6,7)
- Ensures slots don't span across break (e.g., won't create 2,3 if 2 is break)
- Maintains all other constraints (teacher clashes, room clashes, etc.)

## Examples

### 2 Consecutive Hours:
- Subject: Software Design & Development (3 credits)
- Consecutive: 2 Hours
- Result: 2 hours back-to-back on one day, 1 hour on another day
- Possible schedules:
  - Monday: slots 4-5 (2 hours)
  - Wednesday: slot 1 (1 hour)

### 3 Consecutive Hours:
- Subject: Database Systems (3 credits)
- Consecutive: 3 Hours
- Result: All 3 hours back-to-back on one day
- Possible schedules:
  - Tuesday: slots 4-5-6 (3 hours)

## Benefits
- Useful for subjects that benefit from longer continuous sessions
- Reduces context switching for students
- Allows for deeper engagement in complex topics
- Flexible: can be configured per assignment/section

## Technical Notes
- Constraint is HARD (must be satisfied)
- Works with all existing constraints (morning labs, early dismissal, etc.)
- Does not conflict with break slots
- Properly handles different day configurations (Mon-Thu vs Friday)

## Testing
- Migration tested and executed successfully
- UI tested: dropdown appears and saves correctly
- Solver constraint logic implemented and ready for testing

## Backup
- Backup created: `_backups/backup_20260303_231051`
- Contains all critical files before changes

## Status
✅ COMPLETE - Feature fully implemented and ready for use
