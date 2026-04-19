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



@router.post("/teacher-restrictions")
def fix_teacher_restrictions(
    teacher_id: int,
    keep_count: int = 8,
    db: Session = Depends(get_db),
    user=Depends(require_role("super_admin", "program_admin"))
):
    """
    Reduce excessive teacher restrictions by keeping only the most important ones.
    
    Algorithm:
    1. Get all restrictions for the teacher
    2. Keep only 'keep_count' restrictions (default 8)
    3. Prioritize keeping restrictions on specific days/slots (e.g., Friday afternoon)
    """
    from models import TeacherRestriction, Teacher
    
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    
    restrictions = db.query(TeacherRestriction).filter(
        TeacherRestriction.teacher_id == teacher_id
    ).all()
    
    if len(restrictions) <= keep_count:
        return {
            "success": True,
            "message": f"{teacher.name} has {len(restrictions)} restrictions (within limit of {keep_count})",
            "removed": 0
        }
    
    # Sort restrictions: prioritize keeping Friday restrictions
    # Remove restrictions from middle of the week first
    restrictions_sorted = sorted(restrictions, key=lambda r: (
        0 if r.day == 4 else 1,  # Keep Friday restrictions
        abs(r.slot_index - 4)     # Keep restrictions far from middle slots
    ))
    
    # Keep first 'keep_count', remove the rest
    to_keep = restrictions_sorted[:keep_count]
    to_remove = restrictions_sorted[keep_count:]
    
    removed_info = []
    for r in to_remove:
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        removed_info.append(f"{day_names[r.day]} slot {r.slot_index + 1}")
        db.delete(r)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Removed {len(to_remove)} restrictions from {teacher.name}, kept {len(to_keep)}",
        "removed": len(to_remove),
        "removed_slots": removed_info
    }


@router.get("/detect-issues")
def detect_generation_issues(
    session_id: int,
    batch_id: int = None,
    db: Session = Depends(get_db),
    user=Depends(require_role("super_admin", "program_admin"))
):
    """
    Detect common issues that prevent timetable generation.
    Returns actionable fixes.
    """
    from models import Teacher, TeacherRestriction, Assignment, Subject, Batch, Department
    
    issues = []
    
    # Get assignments for this session/batch
    query = db.query(Assignment).filter(Assignment.session_id == session_id)
    if batch_id:
        query = query.filter(Assignment.batch_id == batch_id)
    
    assignments = query.all()
    
    if not assignments:
        return {"issues": [], "message": "No assignments found"}
    
    # Check 1: Teachers with excessive restrictions
    teacher_ids = set()
    for asgn in assignments:
        if asgn.teacher_id:
            teacher_ids.add(asgn.teacher_id)
    
    for tid in teacher_ids:
        restriction_count = db.query(func.count(TeacherRestriction.id)).filter(
            TeacherRestriction.teacher_id == tid
        ).scalar()
        
        if restriction_count > 12:
            teacher = db.query(Teacher).filter(Teacher.id == tid).first()
            issues.append({
                "type": "EXCESSIVE_RESTRICTIONS",
                "severity": "HIGH" if restriction_count > 15 else "MEDIUM",
                "teacher_id": tid,
                "teacher_name": teacher.name if teacher else f"ID {tid}",
                "restriction_count": restriction_count,
                "fix": f"POST /api/autofix/teacher-restrictions?teacher_id={tid}&keep_count=8",
                "description": f"{teacher.name if teacher else 'Teacher'} has {restriction_count} restrictions. Reduce to 8-10 for better scheduling."
            })
    
    # Check 2: Lab room conflicts
    lab_assignments = [a for a in assignments if db.query(Subject).filter(Subject.id == a.subject_id, Subject.lab_credits > 0).first()]
    room_usage = defaultdict(int)
    for asgn in lab_assignments:
        if asgn.lab_room_id:
            room_usage[asgn.lab_room_id] += 1
    
    for room_id, count in room_usage.items():
        if count > 3:
            room = db.query(Room).filter(Room.id == room_id).first()
            issues.append({
                "type": "LAB_ROOM_OVERBOOKED",
                "severity": "HIGH",
                "room_id": room_id,
                "room_name": room.name if room else f"Room {room_id}",
                "lab_count": count,
                "fix": f"POST /api/autofix/lab-room-conflicts?session_id={session_id}",
                "description": f"{room.name if room else 'Room'} has {count} labs assigned (max 3 per day)"
            })
    
    return {
        "issues": issues,
        "count": len(issues),
        "message": f"Found {len(issues)} potential issues" if issues else "No issues detected"
    }
