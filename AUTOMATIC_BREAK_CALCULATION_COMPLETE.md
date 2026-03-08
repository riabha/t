# Automatic Break Time Calculation - Complete ✅

**Date**: March 3, 2026  
**Status**: Implemented and Ready

## Overview
Simplified break time configuration by automatically calculating break start and end times based on slot position. Users only need to select which slot number the break should occur after and how long the break should be.

## User Interface

### Inputs
1. **Break After Slot** - Dropdown selector (Slot #1 through Slot #8)
   - Default: Slot #3 (index 2)
   - User selects which slot the break comes after

2. **Break Duration (min)** - Number input
   - Default: 30 minutes
   - User enters how long the break lasts

### Visual Feedback
- **Blue info box** shows calculated break time in real-time
- Example: "ℹ️ Break will be placed after slot 3 (10:30 - 11:00)"
- Updates automatically when user changes slot or duration

## How It Works

### Calculation Logic
```javascript
const calculateBreakTimes = () => {
    const [startH, startM] = startTime.split(':').map(Number);
    
    // Calculate break start time (after breakSlot number of classes)
    const breakStartMinutes = (startH * 60 + startM) + (breakSlot * classDuration);
    const breakStartH = Math.floor(breakStartMinutes / 60);
    const breakStartM = breakStartMinutes % 60;
    const breakStart = `${breakStartH.toString().padStart(2, '0')}:${breakStartM.toString().padStart(2, '0')}`;
    
    // Calculate break end time
    const breakEndMinutes = breakStartMinutes + breakDuration;
    const breakEndH = Math.floor(breakEndMinutes / 60);
    const breakEndM = breakEndMinutes % 60;
    const breakEnd = `${breakEndH.toString().padStart(2, '0')}:${breakEndM.toString().padStart(2, '0')}`;
    
    return { breakStart, breakEnd };
};
```

### Backend Integration
The solver automatically handles lab placement conflicts:
- Labs are 3-hour blocks (3 consecutive slots)
- Solver excludes any lab start that would span across the break slot
- This is handled automatically in `get_lab_starts()` function

## Example Calculations

**Example 1: Standard Schedule (Default)**
- Start Time: 08:30
- Class Duration: 60 min
- Break After Slot: #3 (index 2)
- Break Duration: 30 min
- **Result**: Break at 10:30 - 11:00

**Example 2: Early Start**
- Start Time: 08:00
- Class Duration: 60 min
- Break After Slot: #3 (index 2)
- Break Duration: 30 min
- **Result**: Break at 10:00 - 10:30

**Example 3: Slot #4 Break**
- Start Time: 08:30
- Class Duration: 60 min
- Break After Slot: #4 (index 3)
- Break Duration: 30 min
- **Result**: Break at 11:30 - 12:00

**Example 4: Longer Break**
- Start Time: 08:30
- Class Duration: 60 min
- Break After Slot: #3 (index 2)
- Break Duration: 45 min
- **Result**: Break at 10:30 - 11:15

## Benefits

1. **Simple**: Just select slot number and duration
2. **Automatic**: Times calculated instantly
3. **Visual**: See exact break time before generating
4. **Flexible**: Works with any start time, class duration, and break duration
5. **Robust**: Backend solver handles lab placement automatically

## Technical Details

### Files Modified
- `frontend/src/pages/TimetablePage.jsx`

### State Variables
```javascript
const [breakSlot, setBreakSlot] = useState(2); // Break after slot #3 (index 2)
const [breakDuration, setBreakDuration] = useState(30); // Break duration in minutes
```

### Calculation Function
- Converts start time to minutes
- Adds (slot_number × class_duration) to get break start
- Adds break_duration to get break end
- Converts back to HH:MM format

### Backend Robustness
- `get_lab_starts()` in solver.py automatically filters valid lab starts
- Labs cannot span across break slot
- No manual validation needed - solver handles it

## User Workflow

1. User sets "Start Time" (e.g., 08:30)
2. User sets "Class Duration" (e.g., 60 min)
3. User selects "Break After Slot" (e.g., Slot #3)
4. User sets "Break Duration" (e.g., 30 minutes)
5. Info box shows: "Break will be placed after slot 3 (10:30 - 11:00)"
6. User clicks Generate
7. Timetable created with correct break times

## Notes
- No warnings or validation in frontend - kept simple
- Backend solver automatically handles lab placement conflicts
- Default is Slot #3 with 30-minute duration
- Info box updates in real-time
- No database or backend changes required
