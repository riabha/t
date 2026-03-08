#!/usr/bin/env python3
"""Check 23BAE assignments in detail."""

from database import SessionLocal
from models import Assignment, Batch, Section, Subject

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.display_name == "23BAE").first()
if not batch:
    print("23BAE batch not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"23BAE BATCH ANALYSIS")
print(f"{'='*80}\n")

# Get sections
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
print(f"Sections: {', '.join([s.display_name for s in sections])}")
print(f"Number of sections: {len(sections)}\n")

# Get assignments
assignments = db.query(Assignment).filter(
    Assignment.section_ids.any(batch.id)
).all()

# Filter to only those that include 23BAE sections
section_ids = [s.id for s in sections]
bae_assignments = []
for asg in assignments:
    if any(sid in section_ids for sid in asg.section_ids):
        bae_assignments.append(asg)

print(f"Total assignments: {len(bae_assignments)}\n")

# Calculate total slots needed
total_theory = 0
total_lab = 0

print(f"{'Subject':<20} {'Theory':<8} {'Lab':<8} {'Sections':<10} {'Total Slots'}")
print(f"{'-'*70}")

for asg in bae_assignments:
    subject = asg.subject
    # Count how many 23BAE sections this assignment covers
    asg_section_count = len([sid for sid in asg.section_ids if sid in section_ids])
    
    theory_slots = subject.theory_credits * asg_section_count
    lab_slots = subject.lab_credits * asg_section_count
    
    total_theory += theory_slots
    total_lab += lab_slots
    
    print(f"{subject.code:<20} {subject.theory_credits:<8} {subject.lab_credits:<8} {asg_section_count:<10} {theory_slots + lab_slots}")

print(f"{'-'*70}")
print(f"{'TOTAL':<20} {'':<8} {'':<8} {'':<10} {total_theory + total_lab}")
print(f"\nTheory slots: {total_theory}")
print(f"Lab slots: {total_lab}")
print(f"Total slots needed: {total_theory + total_lab}")
print(f"Available capacity: 32 slots/week")
print(f"Utilization: {((total_theory + total_lab) / 32 * 100):.1f}%")

if total_theory + total_lab > 32:
    print(f"\n⚠️  OVER CAPACITY by {total_theory + total_lab - 32} slots!")
elif total_theory + total_lab == 32:
    print(f"\n⚠️  AT 100% CAPACITY - NO FLEXIBILITY!")
else:
    print(f"\n✅ Within capacity ({32 - total_theory - total_lab} slots free)")

print(f"\n{'='*80}\n")

db.close()
