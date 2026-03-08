"""
Import data from JSON export into PostgreSQL database.
Run this INSIDE the Docker container after database tables are created.
"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    User, Department, Teacher, Subject, Room, Section, Batch,
    Assignment, TeacherRestriction, Timetable, TimetableSlot,
    ScheduleConfig, GlobalConfig, AssignmentSession
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
        
        # Import Batches
        print("Importing batches...")
        for item in data['batches']:
            batch = Batch(**item)
            db.add(batch)
        db.commit()
        print(f"✅ Imported {len(data['batches'])} batches")
        
        # Import Schedule Configs
        print("Importing schedule configs...")
        for item in data['schedule_configs']:
            config = ScheduleConfig(**item)
            db.add(config)
        db.commit()
        print(f"✅ Imported {len(data['schedule_configs'])} schedule configs")
        
        # Import Global Configs
        print("Importing global configs...")
        for item in data['global_configs']:
            gconfig = GlobalConfig(**item)
            db.add(gconfig)
        db.commit()
        print(f"✅ Imported {len(data['global_configs'])} global configs")
        
        # Import Assignment Sessions
        print("Importing assignment sessions...")
        for item in data['assignment_sessions']:
            if item.get('created_at'):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
            session = AssignmentSession(**item)
            db.add(session)
        db.commit()
        print(f"✅ Imported {len(data['assignment_sessions'])} assignment sessions")
        
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
        print("Importing teacher restrictions...")
        for item in data['teacher_restrictions']:
            restriction = TeacherRestriction(**item)
            db.add(restriction)
        db.commit()
        print(f"✅ Imported {len(data['teacher_restrictions'])} teacher restrictions")
        
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
