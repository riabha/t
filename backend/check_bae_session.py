#!/usr/bin/env python3
"""Check which session has BAE assignments."""

from database import SessionLocal
from models import Assignment, Batch, Department, AssignmentSession
from collections import defaultdict

db = SessionLocal()

# Get BAE department
bae_dept = db.query(Department).filter(Department.code == "BAE").first()
if not bae_dept:
    print("BAE department not found!")
    exit(1)

print(f"\n{'='*80}")
print(f"BAE ASSIGNMENTS BY SESSION")
print(f"{'='*80}\n")

# Get all sessions
sessions = db.query(AssignmentSession).all()

for session in sessions:
    # Count BAE assignments in this session
    bae_count = db.query(Assignment).join(Batch).filter(
        Assignment.session_id == session.id,
        Batch.department_id == bae_dept.id
    ).count()
    
    # Count total assignments in this session
    total_count = db.query(Assignment).filter(
        Assignment.session_id == session.id
    ).count()
    
    if bae_count > 0:
        print(f"✅ Session: {session.name} (ID: {session.id})")
        print(f"   BAE Assignments: {bae_count}")
        print(f"   Total Assignments: {total_count}")
        print()

# Check if there are BAE assignments without a session
no_session = db.query(Assignment).join(Batch).filter(
    Assignment.session_id == None,
    Batch.department_id == bae_dept.id
).count()

if no_session > 0:
    print(f"⚠️  {no_session} BAE assignments have NO session assigned!")
    print()

print(f"{'='*80}\n")

db.close()
