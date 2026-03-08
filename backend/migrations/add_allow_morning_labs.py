"""
Migration: Add allow_morning_labs field to GlobalConfig
Date: 2026-03-01
Purpose: Add checkbox to control whether labs can be placed in morning slots (slot 0)
"""

from sqlalchemy import create_engine, Boolean, Column, MetaData, Table, text
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./timetable.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(bind=engine)

def upgrade():
    """Add allow_morning_labs column to global_configs table"""
    db = SessionLocal()
    try:
        # Check if column already exists
        result = db.execute(text("PRAGMA table_info(global_configs)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'allow_morning_labs' not in columns:
            print("Adding allow_morning_labs column to global_configs...")
            db.execute(text("ALTER TABLE global_configs ADD COLUMN allow_morning_labs BOOLEAN DEFAULT 0"))
            db.commit()
            print("✓ Column added successfully")
        else:
            print("✓ Column allow_morning_labs already exists")
            
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def downgrade():
    """Remove allow_morning_labs column (SQLite doesn't support DROP COLUMN easily)"""
    print("Downgrade not supported for SQLite. Manual intervention required.")

if __name__ == "__main__":
    print("Running migration: add_allow_morning_labs")
    upgrade()
    print("Migration complete!")
