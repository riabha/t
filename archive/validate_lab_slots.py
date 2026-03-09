"""
Validation script to ensure lab slots don't have teacher_id set.
Run this after generating any timetable to verify correctness.
"""
from database import SessionLocal
from models import TimetableSlot, Timetable

db = SessionLocal()

# Check all timetables
timetables = db.query(Timetable).all()

print("Validating lab slot assignments across all timetables...\n")

issues_found = False

for tt in timetables:
    # Find lab slots with teacher_id in this timetable
    bad_slots = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_id == tt.id,
        TimetableSlot.is_lab == True,
        TimetableSlot.teacher_id != None
    ).count()
    
    if bad_slots > 0:
        issues_found = True
        print(f"❌ Timetable {tt.id} ({tt.name}): {bad_slots} lab slots have teacher_id set!")
    else:
        total_labs = db.query(TimetableSlot).filter(
            TimetableSlot.timetable_id == tt.id,
            TimetableSlot.is_lab == True
        ).count()
        if total_labs > 0:
            print(f"✅ Timetable {tt.id} ({tt.name}): {total_labs} lab slots - all correct")

if not issues_found:
    print("\n✅ All timetables validated successfully!")
    print("Lab slots correctly have only lab_engineer_id, no teacher_id.")
else:
    print("\n❌ Issues found! Run fix_lab_teacher_assignments.py to fix.")

db.close()
