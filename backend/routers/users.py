from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Department, Room
from schemas import UserCreate, UserOut, UserUpdate, PasswordChangeRequest
from auth import require_role, hash_password, get_current_user, verify_password

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user = Depends(require_role("super_admin"))):
    """List all users sorted by department (super_admin only)."""
    from sqlalchemy import case
    # Sort by department (nulls last), then by full_name
    users = db.query(User).order_by(
        case((User.department_id == None, 1), else_=0),
        User.department_id,
        User.full_name
    ).all()
    results = []
    for u in users:
        out = UserOut.model_validate(u)
        if u.department:
            out.department_name = u.department.name
        results.append(out)
    return results

def create_default_rooms(db: Session, department_id: int):
    """Create 12 default rooms for a new admin's department."""
    default_rooms = [
        {"name": f"CR-{i:02d}", "capacity": 40, "is_lab": False} for i in range(1, 9)
    ] + [
        {"name": f"Lab-{i:02d}", "capacity": 30, "is_lab": True} for i in range(1, 5)
    ]
    
    for room_data in default_rooms:
        room = Room(
            name=room_data["name"],
            capacity=room_data["capacity"],
            is_lab=room_data["is_lab"],
            department_id=department_id
        )
        db.add(room)
    db.commit()

@router.post("/", response_model=UserOut)
def create_user(req: UserCreate, db: Session = Depends(get_db), current_user = Depends(require_role("super_admin"))):
    """Create a new user (super_admin only)."""
    # Check if username exists
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Optional: check if dept exists if provided
    if req.department_id:
        dept = db.query(Department).filter(Department.id == req.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found")

    new_user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        department_id=req.department_id,
        can_manage_restrictions=req.can_manage_restrictions,
        can_delete_timetable=req.can_delete_timetable,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create default rooms if user is program_admin and has a department
    if req.role == "program_admin" and req.department_id:
        create_default_rooms(db, req.department_id)
    
    return new_user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(require_role("super_admin"))):
    """Delete a user (super_admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting self
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete current user")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, req: UserUpdate, db: Session = Depends(get_db), current_user = Depends(require_role("super_admin"))):
    """Update a user (super_admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if new username conflicts
    if req.username and req.username != user.username:
        existing = db.query(User).filter(User.username == req.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = req.username
    
    if req.full_name:
        user.full_name = req.full_name
    if req.role:
        user.role = req.role
    if req.department_id is not None:
        if req.department_id:
            dept = db.query(Department).filter(Department.id == req.department_id).first()
            if not dept:
                raise HTTPException(status_code=400, detail="Department not found")
        user.department_id = req.department_id
    if req.can_manage_restrictions is not None:
        user.can_manage_restrictions = req.can_manage_restrictions
    if req.can_delete_timetable is not None:
        user.can_delete_timetable = req.can_delete_timetable
    
    db.commit()
    db.refresh(user)
    return user

@router.post("/change-password")
def change_password(req: PasswordChangeRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Change password for current user."""
    # Verify old password
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    
    return {"detail": "Password changed successfully"}

