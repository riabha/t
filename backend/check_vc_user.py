"""
Check if VC user exists in database
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_vc():
    db = SessionLocal()
    
    try:
        # Check all users
        print("\n=== ALL USERS IN DATABASE ===")
        result = db.execute(text("SELECT id, username, role, full_name FROM users")).fetchall()
        
        if not result:
            print("❌ No users found in database!")
        else:
            for user in result:
                print(f"ID: {user[0]}, Username: {user[1]}, Role: {user[2]}, Name: {user[3]}")
        
        print("\n=== CHECKING VC USER ===")
        vc_user = db.execute(text("SELECT * FROM users WHERE username = 'vc'")).fetchone()
        
        if vc_user:
            print("✅ VC user EXISTS!")
            print(f"   ID: {vc_user[0]}")
            print(f"   Username: {vc_user[1]}")
            print(f"   Password Hash: {vc_user[2][:50]}...")
            print(f"   Full Name: {vc_user[3]}")
            print(f"   Role: {vc_user[4]}")
        else:
            print("❌ VC user NOT FOUND!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_vc()
