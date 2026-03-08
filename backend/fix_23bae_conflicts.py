#!/usr/bin/env python3
"""Show exactly what needs to be fixed for 23BAE."""

from database import SessionLocal
from models import Assignment, Batch, Section, Teacher

db = SessionLocal()

print(f"\n{'='*80}")
print(f"23BAE CONFLICT RESOLUTION GUIDE")
print(f"{'='*80}\n")

# Get 23BAE sections
sections = db.query(Section).filter(Section.batch_id == 6).all()
section_ids = [s.id for s in sections]

# Get assignments
assignments = db.query(Assignment).filter(Assignment.session_id == 3).all()
bae_asgs = [a for a in assignments if any(sid in section_ids for sid in a.section_ids)]

print("CURRENT ASSIGNMENTS FOR 23BAE:\n")
print(f"{'Subject':<15} {'Teacher':<30} {'Lab Engineer':<30}")
print(f"{'-'*80}")

for asg in bae_asgs:
    teacher_name = db.query(Teacher).get(asg.teacher_id).name if asg.teacher_id else "None"
    lab_eng_name = db.query(Teacher).get(asg.lab_engineer_id).name if asg.lab_engineer_id else "None"
    print(f"{asg.subject.code:<15} {teacher_name:<30} {lab_eng_name:<30}")

print(f"\n{'='*80}")
print("CONFLICTS DETECTED:\n")

# Find Teacher 81
teacher_81 = db.query(Teacher).get(81)
if teacher_81:
    print(f"⚠️  {teacher_81.name} (ID: 81) has MULTIPLE assignments:")
    print(f"   1. SA-II - Theory (2 hours)")
    print(f"   2. RCD-II - Theory (3 hours)")
    print(f"   3. RCD-II - Lab Engineer (3 hours)")
    print(f"   TOTAL: 8 hours")
    print(f"\n   These cannot be scheduled simultaneously!")

print(f"\n{'='*80}")
print("SOLUTION OPTIONS:\n")

print("Option 1: Change SA-II teacher")
print("  → Go to Assignments page")
print("  → Find SA-II for 23BAE-A")
print("  → Change teacher from 'Engr. Aaqib Munir' to another teacher")
print()

print("Option 2: Change RCD-II teacher")
print("  → Go to Assignments page")
print("  → Find RCD-II for 23BAE-A")
print("  → Change teacher from 'Engr. Aaqib Munir' to another teacher")
print()

print("Option 3: Change RCD-II lab engineer")
print("  → Go to Assignments page")
print("  → Find RCD-II for 23BAE-A")
print("  → Change lab engineer from 'Engr. Aaqib Munir' to another lab engineer")
print()

print("Option 4: Remove one subject")
print("  → Go to Assignments page")
print("  → Delete SA-II assignment for 23BAE-A (smallest subject, 2 hours)")
print()

print(f"{'='*80}")
print("\nRECOMMENDATION:")
print("  Change RCD-II lab engineer to 'Engr. Ibrahim Shaikh' (currently only has QSE lab)")
print("  This is the easiest fix with minimal impact.")
print(f"\n{'='*80}\n")

db.close()
