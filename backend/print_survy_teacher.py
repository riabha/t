import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Assignment, TeacherRestriction

def test():
    db = SessionLocal()
    batch25 = db.query(Batch).join(Department).filter(Batch.year == 25, Department.code == 'CET').first()
    
    asgns = db.query(Assignment).filter(Assignment.batch_id == batch25.id).all()
    print("25CET Assignments:")
    for a in asgns:
        t_name = a.teacher.name if a.teacher else "None"
        print(f"- {a.subject.code}: taught by {t_name}")
        if a.teacher:
            restrictions = db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == a.teacher.id).all()
            if restrictions:
                print(f"  Restrictions for {t_name}:")
                for r in restrictions:
                    print(f"    Day {r.day}, Slot {r.slot_index}")
            else:
                print(f"  No restrictions for {t_name}")
                
    db.close()

if __name__ == "__main__":
    test()
