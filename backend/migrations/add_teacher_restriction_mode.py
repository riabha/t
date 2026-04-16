"""
Migration: Add restriction_mode column to teachers table

This migration adds a per-teacher restriction mode field that allows
each teacher to have their own "strict" or "preferred" restriction enforcement.

- strict: Restrictions are absolute blocks (solver will fail before scheduling)
- preferred: Restrictions are soft constraints (solver avoids but can use with penalty)

Default: "preferred" for backward compatibility
"""

import sys
import os

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal

def run_migration():
    """Add restriction_mode column to teachers table"""
    
    print("=" * 60)
    print("MIGRATION: Add teacher restriction_mode column")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Check if column already exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='teachers' AND column_name='restriction_mode'
        """))
        
        if result.fetchone():
            print("✓ Column 'restriction_mode' already exists in teachers table")
            print("  No migration needed")
            return
        
        print("\n1. Adding restriction_mode column to teachers table...")
        
        # Add the column with default value
        db.execute(text("""
            ALTER TABLE teachers 
            ADD COLUMN restriction_mode VARCHAR(20) DEFAULT 'preferred'
        """))
        
        print("   ✓ Column added successfully")
        
        # Update all existing teachers to have 'preferred' mode
        print("\n2. Setting default restriction_mode for existing teachers...")
        result = db.execute(text("""
            UPDATE teachers 
            SET restriction_mode = 'preferred' 
            WHERE restriction_mode IS NULL
        """))
        
        affected_rows = result.rowcount
        print(f"   ✓ Updated {affected_rows} teachers to 'preferred' mode")
        
        # Commit the changes
        db.commit()
        
        print("\n" + "=" * 60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print("\nWhat changed:")
        print("  • Added 'restriction_mode' column to teachers table")
        print("  • Default value: 'preferred' (backward compatible)")
        print("  • All existing teachers set to 'preferred' mode")
        print("\nNext steps:")
        print("  • Teachers can now have individual restriction modes")
        print("  • Set mode in Restrictions page: Strict or Preferred")
        print("  • Strict = Absolute blocks (solver fails before using)")
        print("  • Preferred = Soft constraints (solver avoids but can use)")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ MIGRATION FAILED: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
