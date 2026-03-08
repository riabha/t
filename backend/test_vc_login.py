"""
Test VC login credentials
Run: python test_vc_login.py
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

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def test_login():
    db = SessionLocal()
    
    try:
        # Get VC user
        result = db.execute(text("SELECT id, username, password_hash, role FROM users WHERE username = 'vc'")).fetchone()
        
        if not result:
            print("❌ VC user not found!")
            return
        
        user_id, username, password_hash, role = result
        
        print("=== VC USER INFO ===")
        print(f"ID: {user_id}")
        print(f"Username: {username}")
        print(f"Role: {role}")
        print(f"Password Hash: {password_hash}")
        print("")
        
        # Test password verification
        test_password = "vc"
        is_valid = verify_password(test_password, password_hash)
        
        print("=== PASSWORD VERIFICATION TEST ===")
        print(f"Testing password: '{test_password}'")
        print(f"Expected hash: {hash_password(test_password)}")
        print(f"Stored hash:   {password_hash}")
        print(f"Match: {is_valid}")
        print("")
        
        if is_valid:
            print("✅ LOGIN CREDENTIALS ARE CORRECT!")
            print("")
            print("   🔐 USE THESE CREDENTIALS:")
            print("   ━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("   Username: vc")
            print("   Password: vc")
            print("   ━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print("")
            print("   Login at: http://localhost:5173/login")
        else:
            print("❌ PASSWORD VERIFICATION FAILED!")
            print("   The password hash does not match.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_login()
