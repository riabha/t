"""
Migration: Add consecutive_lectures field to assignments table

This migration adds support for consecutive lecture scheduling.
Consecutive lectures allow subjects to have back-to-back slots (2 or 3 hours).

Usage:
    python backend/migrations/add_consecutive_lectures.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text

def migrate():
    # Use the correct database file path
    db_path = os.path.join(os.path.dirname(__file__), '..', 'timetable.db')
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("PRAGMA table_info(assignments)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'consecutive_lectures' not in columns:
            print("Adding consecutive_lectures column to assignments table...")
            conn.execute(text("""
                ALTER TABLE assignments 
                ADD COLUMN consecutive_lectures INTEGER NOT NULL DEFAULT 0
            """))
            conn.commit()
            print("✓ Migration complete: consecutive_lectures field added")
        else:
            print("✓ Column consecutive_lectures already exists, skipping migration")

if __name__ == "__main__":
    migrate()
