#!/usr/bin/env python3
"""Test teacher conflict detection for 23BAE."""

from database import SessionLocal
from models import Batch
from solver import generate_timetable

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.display_name == "23BAE").first()
if not batch:
    print("23BAE batch not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"TESTING TEACHER CONFLICT DETECTION FOR 23BAE")
print(f"{'='*80}\n")

try:
    # Try to generate timetable for 23BAE only
    tt = generate_timetable(
        db=db,
        name="Test 23BAE Conflicts",
        session_id=3,  # Session ID for BAE
        batch_ids=[batch.id],
        target_dept_id=batch.department_id
    )
    print(f"\n✅ SUCCESS: Timetable generated (ID: {tt.id})")
    print(f"Status: {tt.status}")
    
except ValueError as e:
    print(f"\n⚠️  EXPECTED ERROR (INFEASIBLE):\n")
    print(str(e))
    print(f"\n{'='*80}")
    print("If you see teacher conflicts listed above, the detection is working!")
    print(f"{'='*80}\n")

db.close()
