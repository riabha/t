"""
Show all batches and their departments
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Batch, Department

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()

try:
    depts = db.query(Department).all()
    print("Departments:")
    for dept in depts:
        print(f"  {dept.code} - {dept.name} (ID: {dept.id})")
    print()
    
    batches = db.query(Batch).all()
    print("Batches:")
    for batch in batches:
        print(f"  {batch.display_name} - {batch.department.name}")

finally:
    db.close()
