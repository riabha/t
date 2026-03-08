#!/usr/bin/env python3
"""Check 23BAE batch configuration."""

from database import SessionLocal
from models import Batch

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"23BAE BATCH CONFIGURATION")
print(f"{'='*80}\n")

print(f"Batch: {batch.display_name}")
print(f"ID: {batch.id}")
print(f"Year: {batch.year}")
print(f"Department: {batch.department.code}")
print(f"Semester: {batch.semester}")
print(f"\nMorning Lab Configuration:")
print(f"  Mode: {batch.morning_lab_mode}")
print(f"  Count: {batch.morning_lab_count}")
print(f"  Days: {batch.morning_lab_days}")

if batch.morning_lab_mode == "strict":
    print(f"\n⚠️  STRICT MORNING LAB MODE DETECTED!")
    print(f"  This restricts theory classes to slots 4-7 on days: {batch.morning_lab_days}")
    print(f"  This significantly reduces available slots and may cause INFEASIBLE")
    print(f"\n  SOLUTION:")
    print(f"    1. Go to Batch Settings")
    print(f"    2. Change morning lab mode from 'strict' to 'prefer' or 'count'")
    print(f"    3. Or set it to None to disable")
elif batch.morning_lab_mode:
    print(f"\n✓ Morning lab mode is '{batch.morning_lab_mode}' (not strict)")
else:
    print(f"\n✓ No morning lab restrictions")

print(f"\n{'='*80}\n")

db.close()
