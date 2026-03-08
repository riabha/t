#!/usr/bin/env python3
"""
Migration: Convert department-specific sessions to university-wide sessions

This migration:
1. Merges duplicate sessions with the same name
2. Updates all assignments to point to the merged session
3. Removes department_id column from assignment_sessions table
4. Makes sessions university-wide

SAFE: Creates backup before running
REVERSIBLE: Can be rolled back if needed
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal, engine
from models import AssignmentSession, Assignment, Department
from sqlalchemy import text, inspect
from collections import defaultdict

def backup_database():
    """Create a backup of the database before migration"""
    import shutil
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Database is in backend folder
    backend_dir = os.path.join(os.path.dirname(__file__), '..')
    db_path = os.path.join(backend_dir, "timetable.db")
    
    if not os.path.exists(db_path):
        print(f"✗ Database not found at: {db_path}")
        return None
    
    backup_file = os.path.join(backend_dir, f"timetable_backup_before_session_migration_{timestamp}.db")
    
    try:
        shutil.copy(db_path, backup_file)
        print(f"✓ Database backed up to: {backup_file}")
        return backup_file
    except Exception as e:
        print(f"✗ Backup failed: {e}")
        return None

def check_if_already_migrated(db):
    """Check if migration has already been run"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('assignment_sessions')]
    
    if 'department_id' not in columns:
        print("✓ Migration already applied (department_id column not found)")
        return True
    return False

def merge_duplicate_sessions(db):
    """Merge sessions with the same name"""
    print("\n=== STEP 1: Merging Duplicate Sessions ===")
    
    # Query directly with SQL to avoid ORM issues with missing columns
    result = db.execute(text("SELECT id, name, is_archived FROM assignment_sessions"))
    sessions_data = result.fetchall()
    
    sessions_by_name = defaultdict(list)
    
    for row in sessions_data:
        sessions_by_name[row[1]].append({'id': row[0], 'name': row[1], 'is_archived': row[2]})
    
    merge_count = 0
    
    for name, sess_list in sessions_by_name.items():
        if len(sess_list) > 1:
            # Keep the first session, merge others into it
            primary_session = sess_list[0]
            print(f"\nMerging sessions for '{name}':")
            print(f"  Primary: Session ID {primary_session['id']}")
            
            for session_to_merge in sess_list[1:]:
                # Update all assignments to point to primary session
                result = db.execute(text(
                    "SELECT COUNT(*) FROM assignments WHERE session_id = :sid"
                ), {"sid": session_to_merge['id']})
                asgn_count = result.scalar()
                
                print(f"  Merging: Session ID {session_to_merge['id']} ({asgn_count} assignments)")
                
                # Update assignments
                db.execute(text(
                    "UPDATE assignments SET session_id = :primary_id WHERE session_id = :merge_id"
                ), {"primary_id": primary_session['id'], "merge_id": session_to_merge['id']})
                
                # Delete the duplicate session
                db.execute(text(
                    "DELETE FROM assignment_sessions WHERE id = :sid"
                ), {"sid": session_to_merge['id']})
                
                merge_count += 1
            
            db.commit()
            print(f"  ✓ Merged {len(sess_list) - 1} duplicate session(s)")
    
    print(f"\n✓ Total sessions merged: {merge_count}")
    return merge_count

def remove_department_id_column():
    """Remove department_id column from assignment_sessions table"""
    print("\n=== STEP 2: Removing department_id Column ===")
    
    try:
        # SQLite doesn't support DROP COLUMN directly
        # We need to recreate the table without the column
        
        # Use raw connection for DDL operations
        with engine.connect() as conn:
            # Create new table without department_id
            conn.execute(text("""
                CREATE TABLE assignment_sessions_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    is_archived BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Copy data from old table (excluding department_id)
            conn.execute(text("""
                INSERT INTO assignment_sessions_new (id, name, is_archived, created_at)
                SELECT id, name, is_archived, CURRENT_TIMESTAMP
                FROM assignment_sessions
            """))
            
            # Drop old table
            conn.execute(text("DROP TABLE assignment_sessions"))
            
            # Rename new table
            conn.execute(text("ALTER TABLE assignment_sessions_new RENAME TO assignment_sessions"))
            
            # Commit the transaction
            conn.commit()
            
        print("✓ department_id column removed successfully")
        return True
            
    except Exception as e:
        print(f"✗ Failed to remove department_id column: {e}")
        import traceback
        traceback.print_exc()
        return False

def verify_migration(db):
    """Verify the migration was successful"""
    print("\n=== STEP 3: Verifying Migration ===")
    
    # Check column is removed
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('assignment_sessions')]
    
    if 'department_id' in columns:
        print("✗ department_id column still exists!")
        return False
    
    print("✓ department_id column removed")
    
    # Check no duplicate session names using SQL
    result = db.execute(text("SELECT COUNT(*) FROM assignment_sessions"))
    total_sessions = result.scalar()
    
    result = db.execute(text("SELECT COUNT(DISTINCT name) FROM assignment_sessions"))
    unique_names = result.scalar()
    
    if total_sessions != unique_names:
        print("✗ Duplicate session names still exist!")
        return False
    
    print(f"✓ All session names are unique ({total_sessions} sessions)")
    
    # Check all assignments have valid session_id
    result = db.execute(text("""
        SELECT COUNT(*) FROM assignments a
        LEFT JOIN assignment_sessions s ON a.session_id = s.id
        WHERE a.session_id IS NOT NULL AND s.id IS NULL
    """))
    invalid_count = result.scalar()
    
    if invalid_count > 0:
        print(f"✗ {invalid_count} assignments have invalid session_id!")
        return False
    
    result = db.execute(text("SELECT COUNT(*) FROM assignments"))
    total_assignments = result.scalar()
    
    print(f"✓ All {total_assignments} assignments have valid session_id")
    
    return True

def main():
    """Run the migration"""
    print("=" * 60)
    print("MIGRATION: University-Wide Sessions")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Check if already migrated
        if check_if_already_migrated(db):
            print("\n✓ Migration already completed. Nothing to do.")
            return True
        
        # Create backup
        print("\n=== Creating Backup ===")
        backup_file = backup_database()
        if not backup_file:
            print("\n✗ Cannot proceed without backup!")
            return False
        
        # Confirm before proceeding
        print("\n" + "=" * 60)
        print("READY TO MIGRATE")
        print("=" * 60)
        print("\nThis will:")
        print("1. Merge duplicate sessions (e.g., 4 'EVEN-2026' → 1 'EVEN-2026')")
        print("2. Update all assignments to use merged sessions")
        print("3. Remove department_id from sessions table")
        print(f"\nBackup created: {backup_file}")
        print("\nPress Enter to continue, or Ctrl+C to cancel...")
        input()
        
        # Run migration steps
        merge_count = merge_duplicate_sessions(db)
        
        # Close the ORM session before DDL operations
        db.close()
        
        if not remove_department_id_column():
            print("\n✗ Migration failed at column removal step")
            return False
        
        # Reopen session for verification
        db = SessionLocal()
        
        # Verify
        if not verify_migration(db):
            print("\n✗ Migration verification failed!")
            return False
        
        print("\n" + "=" * 60)
        print("✓ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nSessions merged: {merge_count}")
        print(f"Backup file: {backup_file}")
        print("\nSessions are now university-wide!")
        
        return True
        
    except KeyboardInterrupt:
        print("\n\n✗ Migration cancelled by user")
        return False
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
