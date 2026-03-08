"""
Migration: Add start_time field to timetables and global_configs
Date: March 3, 2026
Purpose: Allow configurable start time for first lecture (e.g., 08:00, 08:30, 09:00)
"""

import sqlite3
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

def migrate():
    db_path = Path(__file__).parent.parent / "timetable.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add start_time to timetables table
        print("Adding start_time column to timetables table...")
        cursor.execute("""
            ALTER TABLE timetables 
            ADD COLUMN start_time VARCHAR(50) DEFAULT '08:30'
        """)
        print("✓ Added start_time to timetables")
        
        # Add start_time to global_configs table
        print("Adding start_time column to global_configs table...")
        cursor.execute("""
            ALTER TABLE global_configs 
            ADD COLUMN start_time VARCHAR(50) DEFAULT '08:30'
        """)
        print("✓ Added start_time to global_configs")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("   - Timetables can now have custom start times")
        print("   - Default start time is 08:30")
        print("   - You can set it to 08:00, 09:00, or any other time")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️  Column already exists, skipping migration")
        else:
            print(f"❌ Error: {e}")
            conn.rollback()
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
