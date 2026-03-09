"""
List all sections for batch 22 and show assignment structure
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Assignment, Subject, Batch, Section, AssignmentSession
from collections import defaultdict

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()

try:
    batch = db.query(Batch).filter(Batch.year == 22).first()
    if not batch:
        print("Batch 22 not found!")
        exit(1)
    
    print(f"Batch: {batch.display_name}")
    print(f"Department: {batch.department.name}")
    print()
    
    # Get all sections for batch 22
    sections = db.query(Section).filter(Section.batch_id == batch.id).all()
    print(f"Total Sections: {len(sections)}")
    for sec in sections:
        print(f"  - Section {sec.name} (ID: {sec.id})")
    print()
    
    # Get all assignments
    assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()
    
    print(f"Total Assignments: {len(assignments)}")
    print()
    
    # Group by subject
    by_subject = defaultdict(list)
    for asgn in assignments:
        by_subject[asgn.subject.code].append(asgn)
    
    print("Assignments grouped by subject:")
    print("=" * 80)
    
    total_unique_slots = 0
    
    for subject_code in sorted(by_subject.keys()):
        asgns = by_subject[subject_code]
        first = asgns[0]
        subject = first.subject
        
        theory = subject.theory_credits or 0
        lab = subject.lab_credits or 0
        slots = theory + (lab * 3)
        
        print(f"\n{subject_code} - {subject.full_name}")
        print(f"  Credits: {theory}+{lab} = {slots} slots")
        print(f"  Number of assignment records: {len(asgns)}")
        
        for i, asgn in enumerate(asgns, 1):
            teacher = asgn.teacher.name if asgn.teacher else "Not assigned"
            section_names = [sec.name for sec in sections if sec.id in asgn.section_ids]
            print(f"    Assignment {i}: Teacher={teacher}, Sections={section_names}")
        
        # Count this subject only once
        total_unique_slots += slots
    
    print()
    print("=" * 80)
    print(f"TOTAL UNIQUE SLOTS NEEDED: {total_unique_slots}")
    print(f"Available slots per week: 32")
    print()
    
    if total_unique_slots > 32:
        print(f"⚠️  Overflow: {total_unique_slots - 32} slots")
    else:
        print(f"✓ Fits within capacity")

finally:
    db.close()
