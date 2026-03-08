#!/usr/bin/env python3
"""
Migration: Add strict_teacher_restrictions column to global_configs table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import get_db

def add_strict_teacher_restrictions_column():
    """Add strict_teacher_restrictions column to global_configs table"""
    
    db = next(get_db())
    
    try:
        # Check if column already exists
        result = db.execute(text("PRAGMA table_info(global_configs)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'strict_teacher_restrictions' in columns:
            print("✅ Column 'strict_teacher_restrictions' already exists")
            return True
        
        print("🔧 Adding 'strict_teacher_restrictions' column to global_configs table...")
        
        # Add the column with default value
        db.execute(text("""
            ALTER TABLE global_configs 
            ADD COLUMN strict_teacher_restrictions BOOLEAN DEFAULT FALSE
        """))
        
        db.commit()
        print("✅ Successfully added 'strict_teacher_restrictions' column")
        
        # Verify the column was added
        result = db.execute(text("PRAGMA table_info(global_configs)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'strict_teacher_restrictions' in columns:
            print("✅ Column verified in database schema")
            return True
        else:
            print("❌ Column not found after migration")
            return False
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("=== MIGRATION: Add strict_teacher_restrictions column ===")
    success = add_strict_teacher_restrictions_column()
    if success:
        print("🎉 Migration completed successfully")
    else:
        print("💥 Migration failed")
        sys.exit(1)