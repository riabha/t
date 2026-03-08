#!/usr/bin/env python3
"""Check 23BAE lab room assignments."""

from database import SessionLocal
from models import Assignment, Batch, Room

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"23BAE LAB ROOM ASSIGNMENTS")
print(f"{'='*80}\n")

assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

for asg in assignments:
    subject = asg.subject
    if subject.lab_credits > 0:
        lab_room = db.query(Room).filter(Room.id == asg.lab_room_id).first() if asg.lab_room_id else None
        print(f"{subject.code}:")
        print(f"  Lab blocks needed: {subject.lab_credits}")
        print(f"  Assigned lab room: {lab_room.name if lab_room else 'NOT ASSIGNED'}")
        print(f"  Lab room ID: {asg.lab_room_id}")
        
        if not asg.lab_room_id:
            print(f"  ⚠️  NO LAB ROOM ASSIGNED - This will cause INFEASIBLE!")
        print()

print(f"{'='*80}")
print(f"DIAGNOSIS:")
print(f"{'='*80}\n")

unassigned = [asg for asg in assignments if asg.subject.lab_credits > 0 and not asg.lab_room_id]

if unassigned:
    print(f"⚠️  FOUND THE PROBLEM!")
    print(f"\n{len(unassigned)} lab assignment(s) have NO lab room assigned:")
    for asg in unassigned:
        print(f"  • {asg.subject.code}")
    print(f"\nThe solver cannot schedule labs without a lab room assignment.")
    print(f"\nSOLUTION:")
    print(f"  1. Go to Assignments page")
    print(f"  2. Edit each assignment listed above")
    print(f"  3. Assign a lab room from the dropdown")
    print(f"  4. Save and try generating again")
else:
    print(f"✓ All lab assignments have lab rooms assigned")
    print(f"\nThe INFEASIBLE error must be caused by something else.")

print(f"\n{'='*80}\n")

db.close()
