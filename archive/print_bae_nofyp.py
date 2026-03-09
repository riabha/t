import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Timetable, TimetableSlot, Section
from solver import generate_timetable

def test():
    db = SessionLocal()
    bae = db.query(Department).filter(Department.code == 'BAE').first()
    batch22 = db.query(Batch).filter(Batch.year == 22, Batch.department_id == bae.id).first()
    
    # Just generic generation without FYP
    try:
        tt = generate_timetable(
            db=db,
            name='test_bae_nofyp',
            target_dept_id=bae.id,
            max_slots_friday=5,
            prefer_early_dismissal=False,
            allow_friday_labs=False,
            uniform_lab_start_batch_ids=[],
            batch_ids=[batch22.id]
        )
        print(f"Status WITHOUT FYP: {tt.status}")
        
        sec = db.query(Section).filter(Section.batch_id == batch22.id).first()
        slots = db.query(TimetableSlot).filter(
            TimetableSlot.timetable_id == tt.id,
            TimetableSlot.section_id == sec.id
        ).all()
        
        schedule = {d: [] for d in range(5)}
        for s in slots:
            name = s.subject.code if s.subject else "Break"
            if s.label:
                name = f"[{s.label}] {name}"
            elif s.is_break:
                name = "Break"
            elif s.is_lab:
                name += " (Lab)"
            schedule[s.day].append(f"Slot {s.slot_index}: {name}")
            
        for d in range(5):
            print(f"\nDay {d}:")
            for line in sorted(schedule[d]):
                print("  " + line)
                
        db.delete(tt)
        db.commit()
    except Exception as e:
        print(f"Error without FYP: {e}")

    db.close()

if __name__ == "__main__":
    test()
