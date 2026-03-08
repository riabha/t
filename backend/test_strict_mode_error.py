#!/usr/bin/env python3
"""Test that the strict mode error message displays correctly."""

from database import SessionLocal
from models import Batch, Assignment

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"STRICT MODE ERROR MESSAGE TEST")
print(f"{'='*80}\n")

if batch.morning_lab_mode == "strict":
    strict_days = batch.morning_lab_days or []
    strict_day_count = len(strict_days)
    normal_day_count = 5 - strict_day_count
    
    # Calculate available theory slots
    available_theory_slots = (strict_day_count * 4) + (normal_day_count * 7)
    
    # Calculate needed theory slots
    assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()
    theory_needed = sum(asg.subject.theory_credits for asg in assignments)
    
    print(f"Batch: {batch.display_name}")
    print(f"Morning Lab Mode: {batch.morning_lab_mode}")
    print(f"Strict Days: {strict_days} ({strict_day_count} days)")
    print(f"\nTheory Capacity Analysis:")
    print(f"  Strict days ({strict_day_count}): {strict_day_count} × 4 slots = {strict_day_count * 4} slots")
    print(f"  Normal days ({normal_day_count}): {normal_day_count} × 7 slots = {normal_day_count * 7} slots")
    print(f"  Total available: {available_theory_slots} theory slots")
    print(f"  Theory needed: {theory_needed} slots")
    
    if theory_needed > available_theory_slots:
        print(f"\n⚠️  CAPACITY EXCEEDED by {theory_needed - available_theory_slots} slots!")
        print(f"\nWhen you try to generate the timetable, you will now see:")
        print(f"\n" + "="*80)
        print(f"⚠️  STRICT MORNING LAB MODE TOO RESTRICTIVE")
        print(f"\nThe following batches cannot fit their theory classes due to strict morning lab mode:")
        print(f"\n• Batch {batch.display_name}: needs {theory_needed} theory slots but only {available_theory_slots} available")
        print(f"  Strict morning lab mode on {strict_day_count} days limits theory to afternoon slots (4-7)")
        print(f"  This reduces capacity from 34 to {available_theory_slots} theory slots")
        print(f"\nSTRICT MODE restricts theory classes to afternoon slots (4-7) on configured days,")
        print(f"which significantly reduces available capacity.")
        print(f"\nSOLUTION (choose one):")
        print(f"  1. Go to Batch Settings page")
        print(f"  2. Change morning lab mode from 'strict' to 'prefer' or 'count'")
        print(f"  3. Or reduce the number of days with strict mode")
        print(f"  4. Or disable morning lab mode entirely for this batch")
        print(f"\nNOTE: 'prefer' mode encourages morning labs but allows flexibility when needed.")
        print(f"="*80)
    else:
        print(f"\n✓ Sufficient capacity even with strict mode")
else:
    print(f"✓ Batch {batch.display_name} does not have strict morning lab mode")

print(f"\n{'='*80}\n")

db.close()
