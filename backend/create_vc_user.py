"""
Create VC (Vice-Chancellor) user account
Run this once: python create_vc_user.py
"""
from database import SessionLocal
from models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_vc_user():
    db = SessionLocal()
    
    # Check if VC user already exists
    existing = db.query(User).filter(User.username == "vc").first()
    if existing:
        print("VC user already exists!")
        db.close()
        return
    
    # Create VC user
    hashed_password = pwd_context.hash("vc")
    vc_user = User(
        username="vc",
        hashed_password=hashed_password,
        role="super_admin",  # VC has super admin privileges
        full_name="Vice Chancellor",
        email="vc@quest.edu.pk",
        department_id=None  # VC can see all departments
    )
    
    db.add(vc_user)
    db.commit()
    print("✅ VC user created successfully!")
    print("   Username: vc")
    print("   Password: vc")
    print("   Role: super_admin")
    db.close()

if __name__ == "__main__":
    create_vc_user()
