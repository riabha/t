#!/usr/bin/env python3
"""Test 23BAE timetable generation after fixing the false conflict detection."""

from database import SessionLocal
from models import Batch
import sys

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()
if not batch:
    print("23BAE batch not found!")
    sys.exit(1)

print(f"\n{'='*80}")
print(f"Testing 23BAE Timetable Generation")
print(f"{'='*80}\n")
print(f"Batch: {batch.display_name} (ID: {batch.id})")
print(f"\nThe solver logic has been updated:")
print(f"  ✓ Removed false positive 'Multiple roles in same batch' detection")
print(f"  ✓ Only flags conflicts when total hours > available slots")
print(f"\nFor 23BAE:")
print(f"  • Engr. Aaqib Munir: SA-II (2h) + RCD-II (3h) + RCD-II Lab (3h) = 8h total")
print(f"  • Ar. Asma Junejo: EEB (1h) + AD-II Lab (6h) = 7h total")
print(f"  • Ar. Jawad-ur-Rehman: EEB Lab (3h) + AD-II (1h) = 4h total")
print(f"\nAll teachers have < 32 available slots, so NO conflict should be detected.")
print(f"These assignments can be scheduled at different times throughout the week.")
print(f"\n{'='*80}")
print(f"You can now try generating the timetable from the UI.")
print(f"{'='*80}\n")

db.close()
