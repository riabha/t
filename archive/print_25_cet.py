import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Department, Batch, Timetable, TimetableSlot, Section

def test():
    db = SessionLocal()
    # specifically CET batch year 25
    tt = db.query(Timetable).filter(Timetable.name == 'test_early').order_by(Timetable.id.desc()).first()
    if not tt:
        print("timetable test_early not found")
        return
        
    batch25 = db.query(Batch).join(Department).filter(Batch.year == 25, Department.code == 'CET').first()
    sec = db.query(Section).filter(Section.batch_id == batch25.id).first()
    
    print(f"Schedule for {sec.display_name} in {tt.name}")
    slots = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_id == tt.id,
        TimetableSlot.section_id == sec.id
    ).all()
    
    schedule = {d: [] for d in range(5)}
    for s in slots:
        name = s.subject.code if s.subject else "Break"
        if s.is_break:
            name = "Break"
        if s.is_lab:
            name += " (Lab)"
        schedule[s.day].append(f"Slot {s.slot_index}: {name}")
        
    for d in range(5):
        print(f"\nDay {d}:")
        for line in sorted(schedule[d]):
            print("  " + line)
            
    db.close()

if __name__ == "__main__":
    test()
