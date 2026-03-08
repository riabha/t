#!/usr/bin/env python3
"""Minimal test to identify exact constraint causing INFEASIBLE for 23BAE."""

from ortools.sat.python import cp_model
from database import SessionLocal
from models import Assignment, Batch, Section, Teacher
from collections import defaultdict

db = SessionLocal()

# Get 23BAE
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()
sections = db.query(Section).filter(Section.batch_id == batch.id).all()
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

print(f"\n{'='*80}")
print(f"MINIMAL 23BAE SOLVER TEST")
print(f"{'='*80}\n")

# Create minimal model
model = cp_model.CpModel()

DAYS = [0, 1, 2, 3, 4]  # Mon-Fri
SLOTS_PER_DAY = {
    0: [0, 1, 3, 4, 5, 6, 7],  # Mon (skip slot 2 = break)
    1: [0, 1, 3, 4, 5, 6, 7],  # Tue
    2: [0, 1, 3, 4, 5, 6, 7],  # Wed
    3: [0, 1, 3, 4, 5, 6, 7],  # Thu
    4: [0, 1, 2, 3]             # Fri (4 slots, no break)
}

LAB_STARTS = {
    0: [0, 1, 3, 4],  # Mon
    1: [0, 1, 3, 4],  # Tue
    2: [0, 1, 3, 4],  # Wed
    3: [0, 1, 3, 4],  # Thu
    4: []             # Fri - no labs
}

# Create variables for each assignment
theory_vars = {}
lab_vars = {}

print("Creating variables:")
for i, asg in enumerate(assignments):
    subject = asg.subject
    print(f"  Task {i}: {subject.code} - {subject.theory_credits}h theory, {subject.lab_credits}h lab")
    
    # Theory variables
    for d in DAYS:
        for s in SLOTS_PER_DAY[d]:
            var = model.NewBoolVar(f"theory_{i}_{d}_{s}")
            theory_vars[(i, d, s)] = var
    
    # Lab variables
    if subject.lab_credits > 0:
        for d in DAYS:
            for ls in LAB_STARTS[d]:
                var = model.NewBoolVar(f"lab_{i}_{d}_{ls}")
                lab_vars[(i, d, ls)] = var

print(f"\nTotal theory vars: {len(theory_vars)}")
print(f"Total lab vars: {len(lab_vars)}")

# Add basic constraints
print(f"\nAdding constraints:")

# 1. Each task must schedule exactly its required hours
for i, asg in enumerate(assignments):
    subject = asg.subject
    
    # Theory: exactly theory_credits slots
    if subject.theory_credits > 0:
        task_theory_vars = [v for (ti, d, s), v in theory_vars.items() if ti == i]
        model.Add(sum(task_theory_vars) == subject.theory_credits)
        print(f"  • {subject.code}: must schedule {subject.theory_credits} theory slots")
    
    # Lab: exactly lab_credits blocks
    if subject.lab_credits > 0:
        task_lab_vars = [v for (ti, d, ls), v in lab_vars.items() if ti == i]
        model.Add(sum(task_lab_vars) == subject.lab_credits)
        print(f"  • {subject.code}: must schedule {subject.lab_credits} lab blocks")

# 2. Section clash: same section can't have multiple classes at same time
print(f"\n  • Adding section clash constraints...")
section_id = sections[0].id
for d in DAYS:
    for s in SLOTS_PER_DAY[d]:
        # Get all theory vars for this section at this slot
        slot_vars = [v for (i, dd, ss), v in theory_vars.items() if dd == d and ss == s]
        if len(slot_vars) > 1:
            model.Add(sum(slot_vars) <= 1)
        
        # Check lab vars that occupy this slot
        for ls in LAB_STARTS[d]:
            if ls <= s < ls + 3:  # Lab occupies 3 consecutive slots
                lab_slot_vars = [v for (i, dd, lss), v in lab_vars.items() if dd == d and lss == ls]
                if lab_slot_vars:
                    # Can't have theory and lab at same time
                    if slot_vars:
                        for lv in lab_slot_vars:
                            for tv in slot_vars:
                                model.Add(lv + tv <= 1)

# 3. Teacher clash: same teacher can't teach multiple classes at same time
print(f"  • Adding teacher clash constraints...")
teacher_vars_at_slot = defaultdict(list)
for (i, d, s), v in theory_vars.items():
    teacher_id = assignments[i].teacher_id
    if teacher_id:
        teacher_vars_at_slot[(teacher_id, d, s)].append(v)

for (teacher_id, d, s), vars_list in teacher_vars_at_slot.items():
    if len(vars_list) > 1:
        model.Add(sum(vars_list) <= 1)

# Similar for lab engineers
lab_eng_vars_at_slot = defaultdict(list)
for (i, d, ls), v in lab_vars.items():
    lab_eng_id = assignments[i].lab_engineer_id
    if lab_eng_id:
        for offset in range(3):
            lab_eng_vars_at_slot[(lab_eng_id, d, ls + offset)].append(v)

for (lab_eng_id, d, s), vars_list in lab_eng_vars_at_slot.items():
    if len(vars_list) > 1:
        model.Add(sum(vars_list) <= 1)

print(f"\nSolving...")
solver = cp_model.CpSolver()
solver.parameters.log_search_progress = True
status = solver.Solve(model)

print(f"\n{'='*80}")
print(f"RESULT: {solver.StatusName(status)}")
print(f"{'='*80}\n")

if status == cp_model.INFEASIBLE:
    print("⚠️  INFEASIBLE with minimal constraints!")
    print("\nThis means even with just basic constraints (no gaps, no restrictions, etc.),")
    print("the problem cannot be solved.")
    print("\nPossible causes:")
    print("  1. Teacher/Lab Engineer assigned to overlapping time slots")
    print("  2. Not enough time slots to fit all classes")
    print("  3. Lab blocks conflicting with theory slots")
elif status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    print("✓ FEASIBLE with minimal constraints!")
    print("\nThe basic problem CAN be solved.")
    print("The INFEASIBLE error in the full solver is caused by additional constraints:")
    print("  - No-gaps constraint")
    print("  - Teacher restrictions")
    print("  - Consecutive lectures")
    print("  - Morning lab preferences")
    print("  - etc.")

print(f"\n{'='*80}\n")

db.close()
