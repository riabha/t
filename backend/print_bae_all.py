import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Timetable
from solver import generate_timetable

def test():
    db = SessionLocal()
    bae = db.query(Department).filter(Department.code == 'BAE').first()
    batches = db.query(Batch).filter(Batch.department_id == bae.id).all()
    for b in sorted(batches, key=lambda x: x.year):
        print(f"\n--- Testing Batch {b.year}BAE ---")
        try:
            # Silence stdout
            import io
            import contextlib
            with contextlib.redirect_stdout(io.StringIO()):
                tt = generate_timetable(
                    db=db,
                    name=f'test_bae_{b.year}',
                    target_dept_id=bae.id,
                    max_slots_friday=5,
                    prefer_early_dismissal=False,
                    allow_friday_labs=False,
                    uniform_lab_start_batch_ids=[],
                    batch_ids=[b.id] 
                )
            print(f"Status: {tt.status}")
            db.delete(tt)
            db.commit()
        except Exception as e:
            print(f"Error ({b.year}BAE): {e}")

    db.close()

if __name__ == "__main__":
    test()
