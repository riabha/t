"""
Fix VC user password - Update to SHA-256 hash
Run: python fix_vc_password.py
"""
import hashlib
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def hash_password(password: str) -> str:
    """SHA-256 password hashing - same as auth.py"""
    return hashlib.sha256(password.encode()).hexdigest()

def fix_vc_password():
    db = SessionLocal()
    
    try:
        # Check if VC user exists
        result = db.execute(text("SELECT id, username, password_hash FROM users WHERE username = 'vc'")).fetchone()
        
        if not result:
            print("❌ VC user does not exist!")
            print("   Run create_vc_user.py first")
            db.close()
            return
        
        user_id = result[0]
        old_hash = result[2]
        
        print(f"✅ Found VC user (ID: {user_id})")
        print(f"   Old hash: {old_hash[:50]}...")
        
        # Generate correct SHA-256 hash for password "vc"
        new_hash = hash_password("vc")
        print(f"   New hash: {new_hash}")
        
        # Update password
        db.execute(text("""
            UPDATE users 
            SET password_hash = :new_hash 
            WHERE id = :user_id
        """), {
            'new_hash': new_hash,
            'user_id': user_id
        })
        
        db.commit()
        
        print("")
        print("✅ VC password updated successfully!")
        print("")
        print("   🔐 LOGIN CREDENTIALS:")
        print("   ━━━━━━━━━━━━━━━━━━━━━━")
        print("   Username: vc")
        print("   Password: vc")
        print("   Role: super_admin")
        print("   ━━━━━━━━━━━━━━━━━━━━━━")
        print("")
        print("   You can now login at: http://localhost:5173/login")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_vc_password()
