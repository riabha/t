import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Assignment, TeacherRestriction

def test():
    db = SessionLocal()
    bae = db.query(Department).filter(Department.code == 'BAE').first()
    batch22 = db.query(Batch).filter(Batch.year == 22, Batch.department_id == bae.id).first()
    
    asgns = db.query(Assignment).filter(Assignment.batch_id == batch22.id).all()
    print("22BAE Assignments:")
    for a in asgns:
        t_name = a.teacher.name if a.teacher else "None"
        le_name = a.lab_engineer.name if a.lab_engineer else "None"
        print(f"- {a.subject.code}: taught by {t_name}, Lab by {le_name}")
        
        for teacher, label in [(a.teacher, "Theory"), (a.lab_engineer, "Lab Engineer")]:
            if teacher:
                restrictions = db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == teacher.id).all()
                if restrictions:
                    print(f"  Restrictions for {teacher.name} ({label}):")
                    for r in restrictions:
                        print(f"    Day {r.day}, Slot {r.slot_index}")
                
    db.close()

if __name__ == "__main__":
    test()
