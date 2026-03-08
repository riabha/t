"""
Import data from JSON export into PostgreSQL database.
Run this INSIDE the Docker container after database tables are created.
"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    User, Department, Teacher, Subject, Room, Section,
    Assignment, Restriction, Timetable, TimetableSlot, UniversitySession
)

def import_data():
    db = SessionLocal()
    
    try:
        # Load JSON data
        with open('data_export.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print("📥 Starting data import...")
        
        # Import Departments first (no dependencies)
        print("Importing departments...")
        for item in data['departments']:
            dept = Department(**item)
            db.add(dept)
        db.commit()
        print(f"✅ Imported {len(data['departments'])} departments")
        
        # Import University Sessions
        print("Importing university sessions...")
        for item in data['university_sessions']:
            session = UniversitySession(**item)
            db.add(session)
        db.commit()
        print(f"✅ Imported {len(data['university_sessions'])} university sessions")
        
        # Import Users
        print("Importing users...")
        for item in data['users']:
            user = User(**item)
            db.add(user)
        db.commit()
        print(f"✅ Imported {len(data['users'])} users")
        
        # Import Teachers
        print("Importing teachers...")
        for item in data['teachers']:
            teacher = Teacher(**item)
            db.add(teacher)
        db.commit()
        print(f"✅ Imported {len(data['teachers'])} teachers")
        
        # Import Subjects
        print("Importing subjects...")
        for item in data['subjects']:
            subject = Subject(**item)
            db.add(subject)
        db.commit()
        print(f"✅ Imported {len(data['subjects'])} subjects")
        
        # Import Rooms
        print("Importing rooms...")
        for item in data['rooms']:
            room = Room(**item)
            db.add(room)
        db.commit()
        print(f"✅ Imported {len(data['rooms'])} rooms")
        
        # Import Sections
        print("Importing sections...")
        for item in data['sections']:
            section = Section(**item)
            db.add(section)
        db.commit()
        print(f"✅ Imported {len(data['sections'])} sections")
        
        # Import Assignments
        print("Importing assignments...")
        for item in data['assignments']:
            assignment = Assignment(**item)
            db.add(assignment)
        db.commit()
        print(f"✅ Imported {len(data['assignments'])} assignments")
        
        # Import Restrictions
        print("Importing restrictions...")
        for item in data['restrictions']:
            restriction = Restriction(**item)
            db.add(restriction)
        db.commit()
        print(f"✅ Imported {len(data['restrictions'])} restrictions")
        
        # Import Timetables
        print("Importing timetables...")
        for item in data['timetables']:
            # Convert ISO format strings back to datetime
            if item.get('created_at'):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
            if item.get('updated_at'):
                item['updated_at'] = datetime.fromisoformat(item['updated_at'])
            
            timetable = Timetable(**item)
            db.add(timetable)
        db.commit()
        print(f"✅ Imported {len(data['timetables'])} timetables")
        
        # Import Timetable Slots
        print("Importing timetable slots...")
        for item in data['timetable_slots']:
            slot = TimetableSlot(**item)
            db.add(slot)
        db.commit()
        print(f"✅ Imported {len(data['timetable_slots'])} timetable slots")
        
        print("\n🎉 Data import completed successfully!")
        print("Your PostgreSQL database is now populated with all data from SQLite.")
        
    except Exception as e:
        print(f"❌ Error during import: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import_data()
