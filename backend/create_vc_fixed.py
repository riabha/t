"""
Create VC user - Fixed version
Run: python create_vc_fixed.py
"""
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_vc_user():
    db = SessionLocal()
    
    try:
        # Check if VC user exists
        result = db.execute(text("SELECT * FROM users WHERE username = 'vc'")).fetchone()
        
        if result:
            print("❌ VC user already exists!")
            print(f"   Username: vc")
            print(f"   Role: {result[3] if len(result) > 3 else 'unknown'}")
            db.close()
            return
        
        # Create VC user with bcrypt hash of "vc"
        # This hash is: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN96UUeP/9C0L8yNd.sCO
        db.execute(text("""
            INSERT INTO users (username, password_hash, role, full_name, department_id, teacher_id, can_manage_restrictions, can_delete_timetable)
            VALUES (:username, :password, :role, :full_name, :dept_id, :teacher_id, :can_manage_restrictions, :can_delete_timetable)
        """), {
            'username': 'vc',
            'password': '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN96UUeP/9C0L8yNd.sCO',
            'role': 'super_admin',
            'full_name': 'Vice Chancellor',
            'dept_id': None,
            'teacher_id': None,
            'can_manage_restrictions': True,
            'can_delete_timetable': True
        })
        
        db.commit()
        print("✅ VC user created successfully!")
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
    create_vc_user()
