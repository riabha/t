#!/usr/bin/env python3
"""Check 23BAE slot calculation."""

from database import SessionLocal
from models import Assignment, Batch, Section, Subject

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.display_name == "23BAE").first()
if not batch:
    print("23BAE batch not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"23BAE SLOT CALCULATION BREAKDOWN")
print(f"{'='*80}\n")

# Get sections
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
print(f"Sections: {', '.join([s.display_name for s in sections])}")
print(f"Number of sections: {len(sections)}\n")

# Get all assignments for this batch
assignments = db.query(Assignment).join(Section).filter(Section.batch_id == batch.id).all()

print(f"Total assignments: {len(assignments)}\n")

# Calculate slots per subject (NOT per section, as sections are scheduled together)
print(f"{'Subject':<25} {'Theory':<10} {'Lab':<10} {'Slots':<10}")
print(f"{'-'*70}")

total_theory = 0
total_lab = 0
subjects_seen = set()

for asg in assignments:
    subject = asg.subject
    
    # Only count each subject once (sections are scheduled at the same time)
    if subject.id not in subjects_seen:
        subjects_seen.add(subject.id)
        
        theory_slots = subject.theory_credits
        lab_slots = subject.lab_credits * 3  # Each lab credit = 3 slots
        total_slots = theory_slots + lab_slots
        
        total_theory += theory_slots
        total_lab += lab_slots
        
        print(f"{subject.code:<25} {theory_slots:<10} {lab_slots:<10} {total_slots:<10}")

print(f"{'-'*70}")
print(f"{'TOTAL':<25} {total_theory:<10} {total_lab:<10} {total_theory + total_lab:<10}")

print(f"\n{'='*80}")
print(f"EXPLANATION:")
print(f"{'='*80}")
print(f"• Theory credits = 1 slot per credit")
print(f"• Lab credits = 3 slots per credit (consecutive)")
print(f"• Sections (A, B, etc.) are scheduled at the SAME TIME")
print(f"• So we count each subject only ONCE, not per section")
print(f"\nTotal slots needed: {total_theory + total_lab}")
print(f"Available capacity: 32 slots/week")
print(f"Utilization: {((total_theory + total_lab) / 32 * 100):.1f}%")

if total_theory + total_lab > 32:
    print(f"\n⚠️  OVER CAPACITY by {total_theory + total_lab - 32} slots!")
else:
    print(f"\n✅ Within capacity ({32 - total_theory - total_lab} slots free)")

print(f"\n{'='*80}\n")

db.close()
