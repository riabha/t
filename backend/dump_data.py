import sys
import os
from database import SessionLocal
from models import Teacher, Assignment, AssignmentSession, Subject, TeacherDepartmentEngagement

db = SessionLocal()
teachers = db.query(Teacher).all()

print("ID | Name | Dept | ThAsgn | LbAsgn | GlobalLoad")
print("-" * 60)
for t in teachers:
    th = db.query(Assignment).filter(Assignment.teacher_id == t.id).count()
    lb = db.query(Assignment).filter(Assignment.lab_engineer_id == t.id).count()
    
    # Calculate load like list_teachers does
    all_asgn = db.query(Assignment).join(AssignmentSession).filter(AssignmentSession.is_archived == False).all()
    load = 0
    for a in all_asgn:
        sec_count = len(a.section_ids) if a.section_ids else 0
        if a.teacher_id == t.id:
            load += (a.subject.theory_credits if a.subject else 0) * sec_count
        if a.lab_engineer_id == t.id:
            load += (a.subject.lab_credits if a.subject else 0) * sec_count * 3
            
    print(f"{t.id:2} | {t.name[:20]:20} | {t.department_id:4} | {th:6} | {lb:6} | {load:10.1f}")
db.close()
