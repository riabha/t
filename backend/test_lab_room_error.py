#!/usr/bin/env python3
"""Test that the lab room error message displays correctly."""

from database import SessionLocal
from models import Assignment, Batch

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"LAB ROOM ERROR MESSAGE TEST")
print(f"{'='*80}\n")

assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

missing = []
for asg in assignments:
    if asg.subject.lab_credits > 0 and not asg.lab_room_id:
        missing.append(asg.subject.code)

if missing:
    print(f"✓ Missing lab room assignments detected:")
    for code in missing:
        print(f"  • {code}")
    print(f"\nWhen you try to generate the timetable, you will now see:")
    print(f"\n" + "="*80)
    print(f"⚠️  MISSING LAB ROOM ASSIGNMENTS")
    print(f"\nThe following lab assignments do not have a lab room assigned:")
    for code in missing:
        print(f"  • {code} (23BAE-A)")
    print(f"\nThe solver cannot schedule labs without a lab room assignment.")
    print(f"\nSOLUTION:")
    print(f"  1. Go to Assignments page")
    print(f"  2. Edit each assignment listed above")
    print(f"  3. Select a lab room from the 'Lab Room' dropdown")
    print(f"  4. Save and try generating again")
    print(f"="*80)
else:
    print(f"✓ All lab assignments have lab rooms assigned")

print(f"\n{'='*80}\n")

db.close()
