"""
Update VC user role from super_admin to vc
Run: python update_vc_role.py
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./timetable.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def update_vc_role():
    db = SessionLocal()
    
    try:
        # Check if VC user exists
        result = db.execute(text("SELECT id, username, role FROM users WHERE username = 'vc'")).fetchone()
        
        if not result:
            print("❌ VC user does not exist!")
            db.close()
            return
        
        user_id, username, old_role = result
        
        print(f"✅ Found VC user (ID: {user_id})")
        print(f"   Current role: {old_role}")
        
        # Update role to 'vc'
        db.execute(text("""
            UPDATE users 
            SET role = 'vc'
            WHERE id = :user_id
        """), {'user_id': user_id})
        
        db.commit()
        
        print("")
        print("✅ VC role updated successfully!")
        print("")
        print("   📋 UPDATED USER INFO:")
        print("   ━━━━━━━━━━━━━━━━━━━━━━")
        print("   Username: vc")
        print("   Password: vc")
        print("   Role: vc (Vice Chancellor)")
        print("   ━━━━━━━━━━━━━━━━━━━━━━")
        print("")
        print("   VC users will now be redirected to VC Master Dashboard")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_vc_role()
