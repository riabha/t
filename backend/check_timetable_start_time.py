"""Check if timetables have start_time field"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Timetable

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()

try:
    timetables = db.query(Timetable).all()
    print(f"Total timetables: {len(timetables)}")
    print()
    
    for tt in timetables:
        print(f"ID: {tt.id}, Name: {tt.name}")
        print(f"  start_time: {tt.start_time}")
        print(f"  break_start_time: {tt.break_start_time}")
        print(f"  break_end_time: {tt.break_end_time}")
        print()

finally:
    db.close()
