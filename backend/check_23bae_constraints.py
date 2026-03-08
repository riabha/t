#!/usr/bin/env python3
"""Check 23BAE assignment constraints."""

from database import SessionLocal
from models import Assignment, Batch, Teacher

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()
if not batch:
    print("23BAE batch not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"23BAE CONSTRAINT ANALYSIS")
print(f"{'='*80}\n")

# Get all assignments for this batch
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

print(f"Checking {len(assignments)} assignments:\n")

for asg in assignments:
    subject = asg.subject
    teacher = asg.teacher
    lab_engineer = asg.lab_engineer
    
    print(f"\n{subject.code}")
    print(f"  Theory: {subject.theory_credits}h, Lab: {subject.lab_credits}h")
    print(f"  Teacher: {teacher.name if teacher else 'N/A'}")
    print(f"  Lab Engineer: {lab_engineer.name if lab_engineer else 'N/A'}")
    print(f"  Consecutive Lectures: {asg.consecutive_lectures}")
    
    # Check teacher restrictions
    if teacher:
        restrictions = [r for r in teacher.restrictions]
        print(f"  Teacher Restrictions: {len(restrictions)} slots")
        if len(restrictions) > 0:
            print(f"    Restricted: {[(r.day, r.slot_index) for r in restrictions]}")
    
    if lab_engineer:
        restrictions = [r for r in lab_engineer.restrictions]
        print(f"  Lab Engineer Restrictions: {len(restrictions)} slots")
        if len(restrictions) > 0:
            print(f"    Restricted: {[(r.day, r.slot_index) for r in restrictions]}")

print(f"\n{'='*80}")
print(f"POTENTIAL ISSUES:")
print(f"{'='*80}\n")

# Check for problematic consecutive lecture requirements
problematic = []
for asg in assignments:
    if asg.consecutive_lectures in [2, 3]:
        subject = asg.subject
        if subject.theory_credits == asg.consecutive_lectures:
            print(f"✓ {subject.code}: {asg.consecutive_lectures} consecutive lectures (matches {subject.theory_credits}h theory)")
        else:
            print(f"⚠️  {subject.code}: {asg.consecutive_lectures} consecutive lectures but {subject.theory_credits}h theory")
            problematic.append(subject.code)

if not problematic:
    print("\n✓ No obvious constraint issues found")
    print("\nThe INFEASIBLE error might be caused by:")
    print("  1. Lab room availability (check if enough lab rooms exist)")
    print("  2. Combination of all constraints together")
    print("  3. Hidden constraint conflicts")
else:
    print(f"\n⚠️  Found {len(problematic)} potentially problematic assignments")

print(f"\n{'='*80}\n")

db.close()
