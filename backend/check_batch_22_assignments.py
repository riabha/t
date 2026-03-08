"""
Debug script to check actual assignments for batch 22
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Assignment, Subject, Batch, Teacher, AssignmentSession

# Database setup
DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()

try:
    # Get batch 22
    batch = db.query(Batch).filter(Batch.year == 22).first()
    if not batch:
        print("Batch 22 not found!")
        exit(1)
    
    print(f"Batch: {batch.year} ({batch.display_name})")
    print(f"Batch ID: {batch.id}")
    print(f"Department: {batch.department.name}")
    print()
    
    # Get active session
    active_session = db.query(AssignmentSession).filter(
        AssignmentSession.is_archived == False
    ).first()
    
    if active_session:
        print(f"Active Session: {active_session.name}")
        print()
    
    # Get all assignments for batch 22
    assignments = db.query(Assignment).filter(
        Assignment.batch_id == batch.id
    ).all()
    
    print(f"Total Assignments for Batch 22: {len(assignments)}")
    print()
    
    total_theory_slots = 0
    total_lab_slots = 0
    
    for i, asgn in enumerate(assignments, 1):
        subject = asgn.subject
        teacher = asgn.teacher
        
        theory_credits = subject.theory_credits or 0
        lab_credits = subject.lab_credits or 0
        lab_slots = lab_credits * 3  # Each lab credit = 3 slots
        
        total_theory_slots += theory_credits
        total_lab_slots += lab_slots
        
        print(f"{i}. {subject.code} - {subject.full_name}")
        print(f"   Theory Credits: {theory_credits}, Lab Credits: {lab_credits}")
        print(f"   Slots needed: {theory_credits + lab_slots}")
        print(f"   Teacher: {teacher.name if teacher else 'Not assigned'}")
        print(f"   Sections: {len(asgn.section_ids)}")
        print()
    
    total_slots = total_theory_slots + total_lab_slots
    print("=" * 60)
    print(f"TOTAL THEORY SLOTS: {total_theory_slots}")
    print(f"TOTAL LAB SLOTS: {total_lab_slots}")
    print(f"TOTAL SLOTS NEEDED: {total_slots}")
    print()
    print(f"Available slots per week: 32")
    print(f"  Monday-Thursday: 7 slots × 4 days = 28 slots")
    print(f"  Friday: 4 slots = 4 slots")
    print(f"  (Break slot excluded from count)")
    print()
    
    if total_slots > 32:
        print(f"⚠️  WARNING: Batch 22 needs {total_slots} slots but only 32 available!")
        print(f"   Overflow: {total_slots - 32} slots")
    else:
        print(f"✓ Batch 22 fits within capacity ({total_slots}/32 slots)")

finally:
    db.close()
