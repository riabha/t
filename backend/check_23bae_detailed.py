#!/usr/bin/env python3
"""Check 23BAE slot calculation in detail."""

from database import SessionLocal
from models import Assignment, Batch, Section, Subject

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()
if not batch:
    print("23BAE batch not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"23BAE SLOT CALCULATION BREAKDOWN")
print(f"{'='*80}\n")
print(f"Batch: {batch.display_name} (ID: {batch.id})")

# Get sections
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
print(f"Sections: {', '.join([s.display_name for s in sections])}")
print(f"Number of sections: {len(sections)}\n")

# Get all assignments for this batch
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

print(f"Total assignments: {len(assignments)}\n")

# Calculate slots per subject (NOT per section, as sections are scheduled together)
print(f"{'Subject':<25} {'Theory':<10} {'Lab':<10} {'Total Slots':<15}")
print(f"{'-'*75}")

total_theory = 0
total_lab_slots = 0
subjects_seen = set()

for asg in assignments:
    subject = asg.subject
    
    # Only count each subject once (sections are scheduled at the same time)
    if subject.id not in subjects_seen:
        subjects_seen.add(subject.id)
        
        theory_slots = subject.theory_credits
        lab_slots = subject.lab_credits * 3  # Each lab credit = 3 consecutive slots
        total_slots = theory_slots + lab_slots
        
        total_theory += theory_slots
        total_lab_slots += lab_slots
        
        print(f"{subject.code:<25} {theory_slots:<10} {lab_slots:<10} {total_slots:<15}")

print(f"{'-'*75}")
print(f"{'TOTAL':<25} {total_theory:<10} {total_lab_slots:<10} {total_theory + total_lab_slots:<15}")

print(f"\n{'='*80}")
print(f"EXPLANATION:")
print(f"{'='*80}")
print(f"• Theory credits = 1 slot per credit")
print(f"• Lab credits = 3 slots per credit (consecutive)")
print(f"• Multiple sections (A, B, etc.) are scheduled at the SAME TIME")
print(f"• Therefore, we count each subject only ONCE, not per section")
print(f"\nTotal slots needed: {total_theory + total_lab_slots}")
print(f"Available capacity: 32 slots/week (8 days × 4 slots, minus breaks)")
print(f"Utilization: {((total_theory + total_lab_slots) / 32 * 100):.1f}%")

if total_theory + total_lab_slots > 32:
    print(f"\n⚠️  OVER CAPACITY by {total_theory + total_lab_slots - 32} slots!")
else:
    print(f"\n✅ Within capacity ({32 - total_theory - total_lab_slots} slots free)")

print(f"\n{'='*80}\n")

db.close()
