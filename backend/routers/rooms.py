"""
Room CRUD endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Room
from schemas import RoomCreate, RoomOut
from auth import require_role, get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.get("/", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Room)
    if user.role == "program_admin":
        # Only see their department's rooms (no global rooms)
        q = q.filter(Room.department_id == user.department_id)
    elif user.role != "super_admin" and user.department_id:
        q = q.filter(Room.department_id == user.department_id)
    # super_admin sees all rooms
        
    return q.order_by(Room.department_id, Room.name).all()


@router.post("/", response_model=RoomOut)
def create_room(data: RoomCreate, db: Session = Depends(get_db),
                user=Depends(require_role("super_admin", "program_admin"))):
    # Program admins can only create rooms for their department
    if user.role == "program_admin":
        dept_id = user.department_id
    else:
        # Super admin can create global rooms (null department_id) or department-specific rooms
        dept_id = data.department_id
    
    r = Room(name=data.name, capacity=data.capacity, department_id=dept_id, is_lab=data.is_lab)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{room_id}", response_model=RoomOut)
def update_room(room_id: int, data: RoomCreate, db: Session = Depends(get_db),
                user=Depends(require_role("super_admin", "program_admin"))):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(404, "Room not found")
    
    # Program admins can only edit their department's rooms
    if user.role == "program_admin" and r.department_id != user.department_id:
        raise HTTPException(403, "Cannot edit rooms from other departments")
    
    r.name = data.name
    r.capacity = data.capacity
    if user.role == "super_admin":
        r.department_id = data.department_id
    r.is_lab = data.is_lab
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db),
                user=Depends(require_role("super_admin", "program_admin"))):
    r = db.query(Room).filter(Room.id == room_id).first()
    if not r:
        raise HTTPException(404, "Room not found")
    
    # Program admins can only delete their department's rooms
    if user.role == "program_admin" and r.department_id != user.department_id:
        raise HTTPException(403, "Cannot delete rooms from other departments")
    
    db.delete(r)
    db.commit()
    return {"ok": True}
