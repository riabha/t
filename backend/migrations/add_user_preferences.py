"""
Migration: Add user_preferences table for saving timetable generation settings
"""
from sqlalchemy import text

def upgrade(db):
    """Add user_preferences table"""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            extra_classes INTEGER DEFAULT 0,
            class_duration INTEGER DEFAULT 60,
            start_time VARCHAR(10) DEFAULT '08:30',
            break_slot INTEGER DEFAULT 2,
            break_duration INTEGER DEFAULT 30,
            max_slots_per_day INTEGER DEFAULT 8,
            max_slots_friday INTEGER DEFAULT 4,
            semester_type VARCHAR(20) DEFAULT 'Fall',
            friday_has_break BOOLEAN DEFAULT FALSE,
            allow_friday_labs BOOLEAN DEFAULT FALSE,
            prefer_early_dismissal BOOLEAN DEFAULT TRUE,
            lab_is_last BOOLEAN DEFAULT TRUE,
            sequential_mode BOOLEAN DEFAULT FALSE
        );
    """))
    db.commit()
    print("✅ Added user_preferences table")

def downgrade(db):
    """Remove user_preferences table"""
    db.execute(text("DROP TABLE IF EXISTS user_preferences CASCADE;"))
    db.commit()
    print("✅ Removed user_preferences table")

if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        upgrade(db)
    finally:
        db.close()
