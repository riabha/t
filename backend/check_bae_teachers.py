#!/usr/bin/env python3
"""Check BAE teacher restrictions and availability."""

from database import SessionLocal
from models import Teacher, Assignment, Batch, Department, Subject, TeacherRestriction, Section
from collections import defaultdict

db = SessionLocal()

# Get BAE department
bae_dept = db.query(Department).filter(Department.code == "BAE").first()
if not bae_dept:
    print("BAE department not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"BAE DEPARTMENT TEACHER ANALYSIS")
print(f"{'='*80}\n")

# Get BAE batches
bae_batches = db.query(Batch).filter(Batch.department_id == bae_dept.id).all()
print(f"BAE Batches: {', '.join([b.display_name for b in bae_batches])}\n")

# Get all assignments for BAE batches
assignments = db.query(Assignment).join(Batch).filter(
    Batch.department_id == bae_dept.id
).all()

print(f"Total BAE Assignments: {len(assignments)}\n")

# Group by teacher
teacher_load = defaultdict(lambda: {"subjects": [], "sections": set(), "theory_hours": 0, "lab_hours": 0})

for asg in assignments:
    # Get section info (assignments can have multiple sections)
    sections = db.query(Section).filter(Section.id.in_(asg.section_ids)).all() if asg.section_ids else []
    section_names = [s.display_name for s in sections]
    
    if asg.teacher_id:
        teacher_load[asg.teacher_id]["subjects"].append(asg.subject.code)
        for sn in section_names:
            teacher_load[asg.teacher_id]["sections"].add(sn)
        teacher_load[asg.teacher_id]["theory_hours"] += asg.subject.theory_credits * len(section_names)
    
    if asg.lab_engineer_id and asg.subject.lab_credits > 0:
        teacher_load[asg.lab_engineer_id]["subjects"].append(f"{asg.subject.code} (Lab)")
        for sn in section_names:
            teacher_load[asg.lab_engineer_id]["sections"].add(sn)
        teacher_load[asg.lab_engineer_id]["lab_hours"] += asg.subject.lab_credits * 3 * len(section_names)

print(f"{'Teacher':<30} {'Subjects':<40} {'Theory':<8} {'Lab':<8} {'Restrictions':<15} {'Available Slots'}")
print(f"{'-'*130}")

for teacher_id, load in sorted(teacher_load.items(), key=lambda x: x[1]["theory_hours"] + x[1]["lab_hours"], reverse=True):
    teacher = db.query(Teacher).get(teacher_id)
    if not teacher:
        continue
    
    # Get restrictions
    restrictions = db.query(TeacherRestriction).filter(
        TeacherRestriction.teacher_id == teacher_id
    ).all()
    
    # Count restricted slots
    restricted_count = len(restrictions)
    
    # Calculate available slots (40 total - restricted)
    # Mon-Thu: 8 slots - 1 break = 7 slots × 4 days = 28
    # Friday: 4 slots = 4
    # Total: 32 slots
    total_slots = 32
    available_slots = total_slots - restricted_count
    
    subjects_str = ', '.join(set(load["subjects"]))[:38]
    theory_lab = f"{load['theory_hours']}h + {load['lab_hours']}h"
    
    # Warning if teacher has very few available slots
    warning = ""
    if available_slots < (load["theory_hours"] + load["lab_hours"]):
        warning = " ⚠️ INSUFFICIENT!"
    elif available_slots < (load["theory_hours"] + load["lab_hours"]) + 5:
        warning = " ⚠️ TIGHT!"
    
    print(f"{teacher.name:<30} {subjects_str:<40} {load['theory_hours']:<8} {load['lab_hours']:<8} {restricted_count:<15} {available_slots}{warning}")

print(f"\n{'='*80}")
print("LEGEND:")
print("  Theory: Theory credit hours per week")
print("  Lab: Lab hours per week (lab_credits × 3)")
print("  Restrictions: Number of restricted time slots")
print("  Available Slots: 32 total - restrictions")
print("  ⚠️ INSUFFICIENT: Available < Required")
print("  ⚠️ TIGHT: Available < Required + 5 (very little flexibility)")
print(f"{'='*80}\n")

# Check for teachers with too many restrictions
print("\nTEACHERS WITH HEAVY RESTRICTIONS:")
for teacher_id, load in teacher_load.items():
    teacher = db.query(Teacher).get(teacher_id)
    restrictions = db.query(TeacherRestriction).filter(
        TeacherRestriction.teacher_id == teacher_id
    ).all()
    
    if len(restrictions) > 15:  # More than half slots restricted
        print(f"  • {teacher.name}: {len(restrictions)} restricted slots (out of 32)")
        # Show which days/slots
        by_day = defaultdict(list)
        for r in restrictions:
            day_name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][r.day]
            by_day[day_name].append(r.slot + 1)
        
        for day, slots in sorted(by_day.items()):
            print(f"    - {day}: Slots {', '.join(map(str, sorted(slots)))}")

db.close()
