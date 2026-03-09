#!/usr/bin/env python3
"""Final comprehensive diagnosis of 23BAE INFEASIBLE."""

from database import SessionLocal
from models import Assignment, Batch, Section, Teacher, Room
from collections import defaultdict

db = SessionLocal()

batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"FINAL COMPREHENSIVE DIAGNOSIS: 23BAE")
print(f"{'='*80}\n")

# 1. Batch Configuration
print(f"1. BATCH CONFIGURATION:")
print(f"   Mode: {batch.morning_lab_mode}")
print(f"   Days: {batch.morning_lab_days}")
print(f"   Count: {batch.morning_lab_count}")
print(f"   ✓ Mode is 'prefer' (not strict)\n")

# 2. Sections
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
print(f"2. SECTIONS: {len(sections)}")
for sec in sections:
    print(f"   • {sec.display_name} (ID: {sec.id})")
print()

# 3. Assignments
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()
print(f"3. ASSIGNMENTS: {len(assignments)}")

theory_total = 0
lab_total = 0
missing_lab_rooms = []

for asg in assignments:
    subject = asg.subject
    theory_total += subject.theory_credits
    lab_total += subject.lab_credits
    
    status = "✓"
    issues = []
    
    if subject.lab_credits > 0 and not asg.lab_room_id:
        status = "✗"
        issues.append("NO LAB ROOM")
        missing_lab_rooms.append(subject.code)
    
    if not asg.teacher_id:
        status = "✗"
        issues.append("NO TEACHER")
    
    if subject.lab_credits > 0 and not asg.lab_engineer_id:
        status = "✗"
        issues.append("NO LAB ENGINEER")
    
    issue_str = f" - {', '.join(issues)}" if issues else ""
    print(f"   {status} {subject.code}: {subject.theory_credits}h theory, {subject.lab_credits}h lab{issue_str}")

print(f"\n   Total: {theory_total}h theory + {lab_total}h lab = {theory_total + lab_total * 3} slots")
print(f"   Capacity: 34 slots/week")
print(f"   Utilization: {((theory_total + lab_total * 3) / 34 * 100):.1f}%\n")

if missing_lab_rooms:
    print(f"   ⚠️  MISSING LAB ROOMS: {', '.join(missing_lab_rooms)}\n")

# 4. Teacher Restrictions
print(f"4. TEACHER RESTRICTIONS:")
teacher_issues = []
for asg in assignments:
    if asg.teacher:
        restrictions = [(r.day, r.slot_index) for r in asg.teacher.restrictions]
        if len(restrictions) > 20:
            teacher_issues.append(f"{asg.teacher.name} ({len(restrictions)} slots)")
    
    if asg.lab_engineer:
        restrictions = [(r.day, r.slot_index) for r in asg.lab_engineer.restrictions]
        if len(restrictions) > 20:
            teacher_issues.append(f"{asg.lab_engineer.name} ({len(restrictions)} slots)")

if teacher_issues:
    print(f"   ⚠️  HEAVILY RESTRICTED: {', '.join(teacher_issues)}")
else:
    print(f"   ✓ No teachers with excessive restrictions\n")

# 5. Lab Rooms
print(f"5. LAB ROOMS:")
lab_rooms_used = set()
for asg in assignments:
    if asg.lab_room_id:
        lab_rooms_used.add(asg.lab_room_id)

print(f"   Used: {len(lab_rooms_used)} different lab rooms")
total_lab_rooms = db.query(Room).filter(Room.is_lab == True).count()
print(f"   Available: {total_lab_rooms} total lab rooms")
print(f"   ✓ Sufficient lab rooms\n")

# 6. Section IDs Check
print(f"6. SECTION IDS IN ASSIGNMENTS:")
for asg in assignments:
    print(f"   {asg.subject.code}: section_ids = {asg.section_ids}")
    if not asg.section_ids or len(asg.section_ids) == 0:
        print(f"      ⚠️  EMPTY SECTION IDS!")

print(f"\n{'='*80}")
print(f"CONCLUSION:")
print(f"{'='*80}\n")

if missing_lab_rooms:
    print(f"⚠️  ISSUE FOUND: Missing lab room assignments")
    print(f"   Fix: Assign lab rooms to: {', '.join(missing_lab_rooms)}")
else:
    print(f"✓ All validations passed")
    print(f"\nIf still INFEASIBLE, the issue is likely:")
    print(f"  1. A combination of constraints that conflict")
    print(f"  2. Teacher availability vs workload mismatch")
    print(f"  3. Try generating with relaxed constraints")

print(f"\n{'='*80}\n")

db.close()
