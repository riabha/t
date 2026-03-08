#!/usr/bin/env python3
"""Check assignment session configuration."""

from database import SessionLocal
from models import Assignment, Batch, AssignmentSession

db = SessionLocal()

batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

print(f"\n{'='*80}")
print(f"ASSIGNMENT SESSION CHECK")
print(f"{'='*80}\n")

assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()

sessions_used = set()
for asg in assignments:
    if asg.session_id:
        sessions_used.add(asg.session_id)

print(f"Assignment Sessions Used: {len(sessions_used)}")

for session_id in sessions_used:
    session = db.query(AssignmentSession).filter(AssignmentSession.id == session_id).first()
    if session:
        print(f"  • {session.name} (ID: {session.id}, Archived: {session.is_archived})")
        
        if session.is_archived:
            print(f"    ⚠️  This session is ARCHIVED!")

assignments_without_session = [asg for asg in assignments if not asg.session_id]
if assignments_without_session:
    print(f"\n⚠️  {len(assignments_without_session)} assignments have NO session:")
    for asg in assignments_without_session:
        print(f"  • {asg.subject.code}")

print(f"\n{'='*80}\n")

db.close()
