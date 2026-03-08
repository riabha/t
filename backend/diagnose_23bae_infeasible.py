#!/usr/bin/env python3
"""Deep diagnosis of 23BAE INFEASIBLE issue."""

from database import SessionLocal
from models import Assignment, Batch, Section, Teacher, Room
from collections import defaultdict

db = SessionLocal()

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"DEEP DIAGNOSIS: 23BAE INFEASIBLE")
print(f"{'='*80}\n")

# Get sections
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
print(f"Sections: {len(sections)} - {', '.join([s.display_name for s in sections])}\n")

# Get assignments
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

print(f"{'='*80}")
print(f"ASSIGNMENT DETAILS")
print(f"{'='*80}\n")

teacher_workload = defaultdict(lambda: {"theory": 0, "lab": 0, "subjects": []})

for asg in assignments:
    subject = asg.subject
    teacher = asg.teacher
    lab_engineer = asg.lab_engineer
    
    print(f"{subject.code}:")
    print(f"  Theory: {subject.theory_credits}h, Lab: {subject.lab_credits}h")
    print(f"  Teacher: {teacher.name if teacher else 'N/A'}")
    print(f"  Lab Engineer: {lab_engineer.name if lab_engineer else 'N/A'}")
    print(f"  Lab Room: {asg.lab_room.name if asg.lab_room else 'N/A'}")
    print(f"  Sections: {len(asg.section_ids)}")
    
    if teacher:
        teacher_workload[teacher.name]["theory"] += subject.theory_credits
        teacher_workload[teacher.name]["subjects"].append(subject.code)
    
    if lab_engineer:
        teacher_workload[lab_engineer.name]["lab"] += subject.lab_credits * 3
        teacher_workload[lab_engineer.name]["subjects"].append(f"{subject.code} Lab")
    
    print()

print(f"{'='*80}")
print(f"TEACHER WORKLOAD ANALYSIS")
print(f"{'='*80}\n")

for teacher_name, load in sorted(teacher_workload.items()):
    total = load["theory"] + load["lab"]
    print(f"{teacher_name}:")
    print(f"  Theory: {load['theory']}h")
    print(f"  Lab: {load['lab']}h")
    print(f"  Total: {total}h")
    print(f"  Subjects: {', '.join(load['subjects'])}")
    
    # Check restrictions
    teacher = db.query(Teacher).filter(Teacher.name == teacher_name).first()
    if teacher:
        restrictions = [(r.day, r.slot_index) for r in teacher.restrictions]
        print(f"  Restrictions: {len(restrictions)} slots")
        if restrictions:
            print(f"    {restrictions}")
        available = 34 - len(restrictions)  # Assuming 34 total slots
        if total > available:
            print(f"  ⚠️  OVERLOADED: Needs {total}h but only {available} slots available!")
    print()

print(f"{'='*80}")
print(f"CONSTRAINT ANALYSIS")
print(f"{'='*80}\n")

# Check for same teacher teaching multiple subjects
print("Teachers with multiple assignments:")
for teacher_name, load in sorted(teacher_workload.items()):
    if len(load["subjects"]) > 1:
        print(f"  • {teacher_name}: {', '.join(load['subjects'])}")

print(f"\n{'='*80}")
print(f"POSSIBLE CAUSES")
print(f"{'='*80}\n")

# Calculate total slots needed
total_theory = sum(asg.subject.theory_credits for asg in assignments)
total_lab = sum(asg.subject.lab_credits * 3 for asg in assignments)
total_needed = total_theory + total_lab

print(f"Total slots needed: {total_needed}")
print(f"  Theory: {total_theory}")
print(f"  Lab: {total_lab}")
print(f"Available capacity: 34 slots/week")
print(f"Utilization: {(total_needed/34*100):.1f}%")

print(f"\nPossible issues:")
print(f"1. Teacher restrictions reducing available slots")
print(f"2. Lab room conflicts (multiple labs need same room at same time)")
print(f"3. Room capacity constraints")
print(f"4. Hidden constraint in solver (consecutive lectures, no-gaps, etc.)")

print(f"\n{'='*80}\n")

db.close()
