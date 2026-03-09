import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Assignment

def test():
    db = SessionLocal()
    bae = db.query(Department).filter(Department.code == 'BAE').first()
    batch22 = db.query(Batch).filter(Batch.year == 22, Batch.department_id == bae.id).first()
    
    asgns = db.query(Assignment).filter(Assignment.batch_id == batch22.id).all()
    print("22BAE Assignments Credits:")
    total_theory = 0
    total_lab = 0
    for a in asgns:
        if a.subject is None:
            continue
        print(f"- {a.subject.code}: Theory={a.subject.theory_credits}, Lab={a.subject.lab_credits}")
        total_theory += a.subject.theory_credits
        total_lab += a.subject.lab_credits
    
    print(f"Total theory credits: {total_theory}")
    print(f"Total lab credits: {total_lab} ({total_lab * 3} slots)")
    db.close()

if __name__ == "__main__":
    test()
