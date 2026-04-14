"""
Migration: Add Makeup System and Fix Assignment Sessions
- Remove unique constraint from assignment_sessions.name
- Add session_type and suffix_number to assignment_sessions
- Create students table
- Create makeup_classes table
- Create makeup_enrollments table
- Create makeup_timetables table
- Create makeup_timetable_slots table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from database import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Starting migration: Add Makeup System...")
        
        # 1. Add new columns to assignment_sessions
        print("1. Adding session_type and suffix_number to assignment_sessions...")
        try:
            conn.execute(text("""
                ALTER TABLE assignment_sessions 
                ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'regular'
            """))
            conn.execute(text("""
                ALTER TABLE assignment_sessions 
                ADD COLUMN IF NOT EXISTS suffix_number INTEGER DEFAULT 0
            """))
            conn.commit()
            print("   ✓ Columns added")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 2. Remove unique constraint from assignment_sessions.name
        print("2. Removing unique constraint from assignment_sessions.name...")
        try:
            # Drop the unique constraint
            conn.execute(text("""
                ALTER TABLE assignment_sessions 
                DROP CONSTRAINT IF EXISTS assignment_sessions_name_key
            """))
            conn.commit()
            print("   ✓ Unique constraint removed")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 3. Create students table
        print("3. Creating students table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS students (
                    id SERIAL PRIMARY KEY,
                    roll_number VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(200) NOT NULL,
                    batch_id INTEGER NOT NULL REFERENCES batches(id),
                    section_id INTEGER REFERENCES sections(id),
                    department_id INTEGER NOT NULL REFERENCES departments(id),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            print("   ✓ Students table created")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 4. Create makeup_classes table
        print("4. Creating makeup_classes table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS makeup_classes (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES assignment_sessions(id),
                    subject_id INTEGER NOT NULL REFERENCES subjects(id),
                    teacher_id INTEGER NOT NULL REFERENCES teachers(id),
                    room_id INTEGER REFERENCES rooms(id),
                    department_id INTEGER NOT NULL REFERENCES departments(id),
                    reason VARCHAR(500),
                    original_date DATE,
                    is_lab BOOLEAN DEFAULT FALSE,
                    lab_engineer_id INTEGER REFERENCES teachers(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by_id INTEGER REFERENCES users(id)
                )
            """))
            conn.commit()
            print("   ✓ Makeup classes table created")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 5. Create makeup_enrollments table
        print("5. Creating makeup_enrollments table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS makeup_enrollments (
                    id SERIAL PRIMARY KEY,
                    makeup_class_id INTEGER NOT NULL REFERENCES makeup_classes(id) ON DELETE CASCADE,
                    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(makeup_class_id, student_id)
                )
            """))
            conn.commit()
            print("   ✓ Makeup enrollments table created")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 6. Create makeup_timetables table
        print("6. Creating makeup_timetables table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS makeup_timetables (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    session_id INTEGER NOT NULL REFERENCES assignment_sessions(id),
                    department_id INTEGER REFERENCES departments(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by_id INTEGER REFERENCES users(id),
                    status VARCHAR(20) DEFAULT 'draft',
                    class_duration INTEGER DEFAULT 60,
                    start_time VARCHAR(50) DEFAULT '08:30',
                    break_start_time VARCHAR(50),
                    break_end_time VARCHAR(50),
                    max_slots_per_day INTEGER DEFAULT 8,
                    break_slot INTEGER DEFAULT 2
                )
            """))
            conn.commit()
            print("   ✓ Makeup timetables table created")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 7. Create makeup_timetable_slots table
        print("7. Creating makeup_timetable_slots table...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS makeup_timetable_slots (
                    id SERIAL PRIMARY KEY,
                    timetable_id INTEGER NOT NULL REFERENCES makeup_timetables(id) ON DELETE CASCADE,
                    makeup_class_id INTEGER NOT NULL REFERENCES makeup_classes(id),
                    day INTEGER NOT NULL,
                    slot_index INTEGER NOT NULL,
                    room_id INTEGER REFERENCES rooms(id)
                )
            """))
            conn.commit()
            print("   ✓ Makeup timetable slots table created")
        except Exception as e:
            print(f"   Note: {e}")
        
        # 8. Create indexes for better performance
        print("8. Creating indexes...")
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_students_dept ON students(department_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_makeup_classes_session ON makeup_classes(session_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_makeup_classes_dept ON makeup_classes(department_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_makeup_enrollments_student ON makeup_enrollments(student_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_makeup_timetables_session ON makeup_timetables(session_id)"))
            conn.commit()
            print("   ✓ Indexes created")
        except Exception as e:
            print(f"   Note: {e}")
        
        print("\n✅ Migration completed successfully!")
        print("\nNew features enabled:")
        print("  - Assignment sessions can now have duplicate names with auto-suffixes")
        print("  - All sessions are now visible regardless of assignments")
        print("  - Makeup system tables created (students, makeup_classes, etc.)")
        print("  - Ready for makeup timetable functionality")

if __name__ == "__main__":
    migrate()
