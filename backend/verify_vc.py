"""
Verify VC user setup
Run: python verify_vc.py
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify():
    db = SessionLocal()
    
    try:
        result = db.execute(text("SELECT id, username, role, full_name FROM users WHERE username = 'vc'")).fetchone()
        
        if result:
            print("VC USER FOUND")
            print(f"ID: {result[0]}")
            print(f"Username: {result[1]}")
            print(f"Role: {result[2]}")
            print(f"Full Name: {result[3]}")
            print("")
            print("LOGIN CREDENTIALS:")
            print("Username: vc")
            print("Password: vc")
            print("")
            if result[2] == 'vc':
                print("SUCCESS: VC user has correct role")
                print("VC users will be redirected to VC Master Dashboard")
            else:
                print(f"WARNING: VC user has role '{result[2]}' instead of 'vc'")
        else:
            print("ERROR: VC user not found")
            
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
