"""
Auto-fix endpoint for common timetable generation issues.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from auth import require_role
from models import Assignment, Room, Subject, Batch, Department
from collections import defaultdict

router = APIRouter(prefix="/api/autofix", tags=["autofix"])


@router.post("/lab-room-conflicts")
def fix_lab_room_conflicts(
    session_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("super_admin", "program_admin"))
):
    """
    Automatically fix lab room over-booking by reassigning labs to available rooms.
    
    Algorithm:
    1. Find all lab assignments in the session
    2. Detect over-booked rooms (more than 3 labs per room)
    3. Find available generic lab rooms (Lab-01, Lab-02, etc.)
    4. Reassign excess labs to available rooms
    """
    
    # Get all lab assignments for this session
    lab_assignments = db.query(Assignment).join(Subject).filter(
        Assignment.session_id == session_id,
        Subject.lab_credits > 0
    ).all()
    
    if not lab_assignments:
        return {"success": False, "message": "No lab assignments found in this session"}
    
    # Count labs per room
    room_usage = defaultdict(list)
    for asgn in lab_assignments:
        if asgn.lab_room_id:
            room_usage[asgn.lab_room_id].append(asgn)
    
    # Find over-booked rooms (more than 3 labs = conflict)
    over_booked = {room_id: asgns for room_id, asgns in room_usage.items() if len(asgns) > 3}
    
    if not over_booked:
        return {"success": True, "message": "No lab room conflicts detected", "changes": 0}
    
    # Get available generic lab rooms
    generic_labs = db.query(Room).filter(
        Room.is_lab == True,
        Room.name.like("Lab-%")
    ).order_by(Room.name).all()
    
    if not generic_labs:
        return {"success": False, "message": "No generic lab rooms (Lab-01, Lab-02, etc.) available for reassignment"}
    
    # Reassign excess labs
    changes = []
    generic_lab_index = 0
    
    for room_id, assignments in over_booked.items():
        room = db.query(Room).filter(Room.id == room_id).first()
        room_name = room.name if room else f"Room {room_id}"
        
        # Keep first 3 labs in original room, reassign the rest
        excess_labs = assignments[3:]
        
        for asgn in excess_labs:
            if generic_lab_index >= len(generic_labs):
                # Wrap around if we run out of generic labs
                generic_lab_index = 0
            
            new_room = generic_labs[generic_lab_index]
            old_room_name = room_name
            
            # Update assignment
            asgn.lab_room_id = new_room.id
            
            # Get subject and batch info for logging
            subject = db.query(Subject).filter(Subject.id == asgn.subject_id).first()
            batch = db.query(Batch).filter(Batch.id == asgn.batch_id).first()
            dept = db.query(Department).filter(Department.id == batch.department_id).first() if batch else None
            
            batch_name = f"{batch.year}{dept.code}" if batch and dept else "Unknown"
            subject_name = subject.code if subject else "Unknown"
            
            changes.append({
                "batch": batch_name,
                "subject": subject_name,
                "from_room": old_room_name,
                "to_room": new_room.name
            })
            
            generic_lab_index += 1
    
    # Commit changes
    db.commit()
    
    return {
        "success": True,
        "message": f"Successfully reassigned {len(changes)} labs to resolve conflicts",
        "changes": changes
    }
