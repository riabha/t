from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Timetable, TimetableSlot

engine = create_engine("sqlite:///./timetable.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Delete all generated timetables to free up slots
old_tts = db.query(Timetable).all()
for tt in old_tts:
    db.query(TimetableSlot).filter(TimetableSlot.timetable_id == tt.id).delete()
    db.delete(tt)

db.commit()
print("Cleaned up old timetables.")
