"""
Diagnostic script to analyze why batch 23 fails after batch 22 succeeds in sequential mode.
"""
import sys
sys.path.insert(0, 'backend')

from database import SessionLocal
from models import Batch, Assignment, Teacher, Section, Subject, TimetableSlot, Timetable
from sqlalchemy import func
from collections import defaultdict

db = SessionLocal()

print("=" * 80)
print("BATCH 23 SEQUENTIAL GENERATION FAILURE DIAGNOSIS")
print("=" * 80)

# Get batch 22 and 23
# display_name is a property, so we need to filter by year or code
# Let's get all batches and find 22 and 23
all_batches = db.query(Batch).all()
batch_22 = None
batch_23 = None

for b in all_batches:
    if '22' in b.display_name:
        batch_22 = b
    if '23' in b.display_name:
        batch_23 = b

if not batch_22 or not batch_23:
    print("\n❌ Could not find batch 22 or 23")
    print(f"Batch 22: {batch_22}")
    print(f"Batch 23: {batch_23}")
    sys.exit(1)

print(f"\n✓ Found Batch 22: {batch_22.display_name} (ID: {batch_22.id})")
print(f"✓ Found Batch 23: {batch_23.display_name} (ID: {batch_23.id})")

# Get assignments for both batches
assignments_22 = db.query(Assignment).filter(Assignment.batch_id == batch_22.id).all()
assignments_23 = db.query(Assignment).filter(Assignment.batch_id == batch_23.id).all()

print(f"\n📊 BATCH 22: {len(assignments_22)} assignments")
print(f"📊 BATCH 23: {len(assignments_23)} assignments")

# Analyze shared teachers
teachers_22 = set()
teachers_23 = set()

for a in assignments_22:
    if a.teacher_id:
        teachers_22.add(a.teacher_id)
    if a.lab_engineer_id:
        teachers_22.add(a.lab_engineer_id)

for a in assignments_23:
    if a.teacher_id:
        teachers_23.add(a.teacher_id)
    if a.lab_engineer_id:
        teachers_23.add(a.lab_engineer_id)

shared_teachers = teachers_22.intersection(teachers_23)

print(f"\n👥 SHARED TEACHERS BETWEEN BATCH 22 AND 23:")
print(f"   Batch 22 teachers: {len(teachers_22)}")
print(f"   Batch 23 teachers: {len(teachers_23)}")
print(f"   Shared teachers: {len(shared_teachers)}")

if shared_teachers:
    print("\n   Shared teacher details:")
    for tid in shared_teachers:
        teacher = db.query(Teacher).filter(Teacher.id == tid).first()
        if teacher:
            # Count assignments for this teacher in both batches
            count_22 = sum(1 for a in assignments_22 if a.teacher_id == tid or a.lab_engineer_id == tid)
            count_23 = sum(1 for a in assignments_23 if a.teacher_id == tid or a.lab_engineer_id == tid)
            print(f"   • {teacher.name} ({teacher.designation})")
            print(f"     - Batch 22: {count_22} assignments")
            print(f"     - Batch 23: {count_23} assignments")
            print(f"     - Restriction mode: {teacher.restriction_mode}")

# Check if batch 22 has a generated timetable
latest_tt = db.query(Timetable).filter(
    Timetable.status.in_(["generated", "active"])
).order_by(Timetable.id.desc()).first()

if latest_tt:
    print(f"\n📅 LATEST TIMETABLE: {latest_tt.name} (ID: {latest_tt.id}, Status: {latest_tt.status})")
    
    # Check if it contains batch 22 slots
    batch_22_slots = db.query(TimetableSlot).join(Section).filter(
        TimetableSlot.timetable_id == latest_tt.id,
        Section.batch_id == batch_22.id
    ).count()
    
    print(f"   Batch 22 slots in this timetable: {batch_22_slots}")
    
    if batch_22_slots > 0:
        # Analyze teacher slot usage from batch 22
        print(f"\n🔒 TEACHER SLOTS OCCUPIED BY BATCH 22:")
        teacher_slots = defaultdict(list)
        
        slots_22 = db.query(TimetableSlot).join(Section).filter(
            TimetableSlot.timetable_id == latest_tt.id,
            Section.batch_id == batch_22.id
        ).all()
        
        for slot in slots_22:
            if slot.teacher_id:
                teacher_slots[slot.teacher_id].append((slot.day, slot.slot_index))
            if slot.lab_engineer_id:
                teacher_slots[slot.lab_engineer_id].append((slot.day, slot.slot_index))
        
        # Show only shared teachers
        for tid in shared_teachers:
            if tid in teacher_slots:
                teacher = db.query(Teacher).filter(Teacher.id == tid).first()
                slots = teacher_slots[tid]
                print(f"   • {teacher.name}: {len(slots)} slots occupied")
                # Group by day
                by_day = defaultdict(list)
                for day, slot in slots:
                    by_day[day].append(slot)
                for day in sorted(by_day.keys()):
                    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
                    print(f"     {day_names[day]}: slots {sorted(by_day[day])}")

# Analyze batch 23 requirements
print(f"\n📋 BATCH 23 REQUIREMENTS:")
total_theory_hours = 0
total_lab_hours = 0

for a in assignments_23:
    subj = db.query(Subject).filter(Subject.id == a.subject_id).first()
    if subj:
        total_theory_hours += subj.theory_credits
        total_lab_hours += subj.lab_credits * 3  # Lab credits × 3 contact hours

print(f"   Total theory hours needed: {total_theory_hours}")
print(f"   Total lab hours needed: {total_lab_hours}")
print(f"   Total contact hours: {total_theory_hours + total_lab_hours}")

# Available slots calculation
# Mon-Thu: 7 slots each (excluding break) = 28 slots
# Fri: 5 slots = 5 slots
# Total: 33 slots per section
print(f"\n   Available slots per section: 33 (28 Mon-Thu + 5 Fri)")
print(f"   Required slots: {total_theory_hours + total_lab_hours}")

if total_theory_hours + total_lab_hours > 33:
    print(f"   ⚠️  WARNING: Not enough slots! Need {total_theory_hours + total_lab_hours} but only 33 available")

# Check for teacher restrictions
print(f"\n🚫 TEACHER RESTRICTIONS FOR BATCH 23:")
from models import TeacherRestriction

for tid in teachers_23:
    teacher = db.query(Teacher).filter(Teacher.id == tid).first()
    restrictions = db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == tid).all()
    
    if restrictions:
        print(f"   • {teacher.name}: {len(restrictions)} restricted slots")
        # Group by day
        by_day = defaultdict(list)
        for r in restrictions:
            by_day[r.day].append(r.slot_index)
        for day in sorted(by_day.keys()):
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
            print(f"     {day_names[day]}: slots {sorted(by_day[day])}")

# Check for lab room conflicts
print(f"\n🔬 LAB ROOM ANALYSIS:")
lab_rooms_22 = set()
lab_rooms_23 = set()

for a in assignments_22:
    if a.lab_room_id:
        lab_rooms_22.add(a.lab_room_id)

for a in assignments_23:
    if a.lab_room_id:
        lab_rooms_23.add(a.lab_room_id)

shared_lab_rooms = lab_rooms_22.intersection(lab_rooms_23)
print(f"   Batch 22 lab rooms: {len(lab_rooms_22)}")
print(f"   Batch 23 lab rooms: {len(lab_rooms_23)}")
print(f"   Shared lab rooms: {len(shared_lab_rooms)}")

if shared_lab_rooms and latest_tt and batch_22_slots > 0:
    print(f"\n   Lab room usage by batch 22:")
    from models import Room
    
    for room_id in shared_lab_rooms:
        room = db.query(Room).filter(Room.id == room_id).first()
        lab_slots = db.query(TimetableSlot).join(Section).filter(
            TimetableSlot.timetable_id == latest_tt.id,
            Section.batch_id == batch_22.id,
            TimetableSlot.room_id == room_id,
            TimetableSlot.is_lab == True
        ).all()
        
        if lab_slots:
            print(f"   • {room.name}: {len(lab_slots)} lab blocks")
            for slot in lab_slots:
                day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
                print(f"     {day_names[slot.day]}: slot {slot.slot_index}")

print("\n" + "=" * 80)
print("DIAGNOSIS COMPLETE")
print("=" * 80)

# Provide recommendations
print("\n💡 RECOMMENDATIONS:")
print()

if len(shared_teachers) > len(teachers_23) * 0.5:
    print("⚠️  HIGH TEACHER OVERLAP: More than 50% of batch 23 teachers are shared with batch 22")
    print("   This significantly constrains the solver in sequential mode.")
    print()

if total_theory_hours + total_lab_hours > 30:
    print("⚠️  HIGH SLOT UTILIZATION: Batch 23 needs many slots, leaving little flexibility")
    print()

print("🔧 SUGGESTED FIXES:")
print("   1. Try REGULAR mode (not sequential) - allows solver to optimize all batches together")
print("   2. Check if batch 22 slots are being loaded as constraints (BUG CHECK)")
print("   3. Review teacher restrictions for shared teachers")
print("   4. Consider reducing batch 23 course load if possible")

db.close()
