#!/usr/bin/env python3
"""Check no-gaps configuration for 23BAE assignments."""

from database import SessionLocal
from models import Assignment, Batch, AssignmentConfig

db = SessionLocal()

batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()
assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

print(f"\n{'='*80}")
print(f"23BAE NO-GAPS CONFIGURATION")
print(f"{'='*80}\n")

for asg in assignments:
    subject = asg.subject
    
    # Check if there's an assignment config
    configs = db.query(AssignmentConfig).filter(AssignmentConfig.assignment_id == asg.id).all()
    
    print(f"{subject.code}:")
    if configs:
        for cfg in configs:
            print(f"  Config ID: {cfg.id}")
            print(f"  No Gaps: {cfg.no_gaps}")
            print(f"  Lab Morning Days: {cfg.lab_morning_days}")
    else:
        print(f"  No config found (defaults to no_gaps=True)")
    print()

print(f"{'='*80}")
print(f"DIAGNOSIS:")
print(f"{'='*80}\n")

print(f"The no-gaps constraint requires that if a section has classes at")
print(f"slots 1 and 3, it MUST also have a class at slot 2 (no gaps).")
print(f"\nWith 30 slots needed and complex teacher/lab constraints,")
print(f"the no-gaps rule might be making it impossible to find a solution.")
print(f"\nSOLUTION:")
print(f"  The no-gaps constraint is currently HARD in normal mode.")
print(f"  It becomes SOFT only in strict morning lab mode.")
print(f"  Since 23BAE is in 'prefer' mode, no-gaps is HARD.")
print(f"\n  To fix: Make no-gaps SOFT for all modes, not just strict mode.")

print(f"\n{'='*80}\n")

db.close()
