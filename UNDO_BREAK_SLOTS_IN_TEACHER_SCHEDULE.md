# How to Undo: Break Slots in Teacher Schedule

## What Was Changed

Added break slots to teacher's individual schedule view (MySchedulePage).

## Files Modified

### 1. backend/routers/timetable.py
**Function:** `get_teacher_timetable()`

**Change:** Added break slots to the response

**To Undo:** Replace the function with this original version:

```python
def get_teacher_timetable(tt_id: int, teacher_id: int,
                          db: Session = Depends(get_db)):
    slots = db.query(TimetableSlot).options(
        joinedload(TimetableSlot.subject),
        joinedload(TimetableSlot.teacher),
        joinedload(TimetableSlot.room),
        joinedload(TimetableSlot.section),
        joinedload(TimetableSlot.lab_engineer)
    ).filter(
        TimetableSlot.timetable_id == tt_id,
        (TimetableSlot.teacher_id == teacher_id) |
        (TimetableSlot.lab_engineer_id == teacher_id),
    ).order_by(TimetableSlot.day, TimetableSlot.slot_index).all()
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    return {
        "teacher": teacher.name if teacher else str(teacher_id),
        "total_hours": len(slots),
        "slots": [_slot_to_out(s).model_dump() for s in slots],
    }
```

### 2. frontend/src/pages/MySchedulePage.jsx
**Function:** `loadAllSchedules()` - slot filtering logic

**Change:** Added condition to always include break slots

**To Undo:** Replace the filter logic with this original version:

```javascript
slots = slots.filter(slot => {
    if (slot.is_lab) {
        // For lab slots, user must be the lab engineer
        return slot.lab_engineer_id === user.teacher_id;
    } else {
        // For theory slots, user must be the teacher
        return slot.teacher_id === user.teacher_id;
    }
});
```

## Quick Undo Commands

### Backend Only (Remove break slots from API)
```bash
# Edit backend/routers/timetable.py
# Find get_teacher_timetable function (around line 326)
# Replace with original version above
```

### Frontend Only (Filter out break slots)
```bash
# Edit frontend/src/pages/MySchedulePage.jsx
# Find loadAllSchedules function (around line 40-60)
# Replace filter logic with original version above
```

### Full Undo (Both)
Do both changes above to completely remove break slots from teacher schedule.

## Why You Might Want to Undo

1. **Cleaner View:** Teachers might prefer seeing only their teaching slots
2. **Less Clutter:** Break slots are obvious from the empty time slots
3. **Consistency:** Other views don't show breaks in teacher schedules
4. **Performance:** Slightly fewer slots to process

## Why You Might Keep It

1. **Complete Schedule:** Shows the full day structure including breaks
2. **Better Context:** Teachers can see when breaks occur
3. **Print-Friendly:** Exported PDFs show complete schedule with breaks
4. **Visual Clarity:** Break slots provide clear time markers

## Current State

- Break slots ARE included in teacher's individual schedule
- Break slots show with "Break" label and time range
- Empty slots (no class) show as empty rounded boxes
- Filled slots (classes) show with subject/section info

## Backup Reference

Original code is backed up in:
- `backup_critical_20260302_235354/backend/routers/timetable.py`
- `backup_critical_20260302_235354/frontend/src/pages/MySchedulePage.jsx`

You can restore from backup if needed.
