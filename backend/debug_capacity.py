"""
Debug script to simulate the diagnostic calculation from solver.py
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Assignment, Subject, Batch, Section
from collections import defaultdict

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()

try:
    # Simulate what solver.py does
    target_assignments = db.query(Assignment).all()
    
    all_sections = db.query(Section).all()
    section_map = {s.id: s for s in all_sections}
    
    # Build tasks like solver does
    tasks = []
    for asgn in target_assignments:
        subj = asgn.subject
        if not subj:
            continue
            
        asgn_sections = [section_map.get(sid) for sid in (asgn.section_ids or []) if section_map.get(sid)]
        if not asgn_sections:
            continue
            
        batch_year = asgn_sections[0].batch.year if asgn_sections[0].batch else 0
        dept_code = asgn_sections[0].batch.department.code if asgn_sections[0].batch and asgn_sections[0].batch.department else ""
        
        tasks.append({
            "assignment": asgn,
            "subject": subj,
            "batch_year": batch_year,
            "dept_code": dept_code,
            "theory_credits": subj.theory_credits,
            "lab_credits": subj.lab_credits,
        })
    
    print(f"Total tasks created: {len(tasks)}")
    print()
    
    # Now do the diagnostic calculation
    total_slots_needed_by_batch = defaultdict(int)
    seen_batch_subjects = set()
    
    for t in tasks:
        batch_year = t["batch_year"]
        dept_code = t.get("dept_code", "")
        subject_id = t["subject"].id
        key = (batch_year, dept_code, subject_id)
        
        # Only count each subject once per batch-department combination (not per section)
        if key not in seen_batch_subjects:
            seen_batch_subjects.add(key)
            needed = t["theory_credits"] + (t["lab_credits"] * 3)
            batch_key = f"{batch_year}{dept_code}"
            total_slots_needed_by_batch[batch_key] += needed
            print(f"Batch {batch_key}, Subject {t['subject'].code}: +{needed} slots")
    
    print()
    print("=" * 60)
    for batch_year in sorted(total_slots_needed_by_batch.keys()):
        needed = total_slots_needed_by_batch[batch_year]
        print(f"Batch {batch_year}: {needed} slots")
    
    print()
    print(f"Available capacity: 32 slots/week")

finally:
    db.close()
