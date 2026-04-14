"""
Makeup Classes Management API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from database import get_db
from models import MakeupClass, MakeupEnrollment, Student, AssignmentSession, Subject, Teacher, Room, Department
from auth import require_role, get_current_user

router = APIRouter(prefix="/api/makeup", tags=["Makeup"])


# ── List Makeup Classes ──────────────────────────────────────────
@router.get("/")
def list_makeup_classes(
    session_id: Optional[int] = None,
    department_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """List makeup classes with optional filters"""
    q = db.query(MakeupClass)
    
    # Filter by department for non-super admins
    if user.role != "super_admin" and user.department_id:
        q = q.filter(MakeupClass.department_id == user.department_id)
    elif department_id:
        q = q.filter(MakeupClass.department_id == department_id)
    
    if session_id:
        q = q.filter(MakeupClass.session_id == session_id)
    
    if subject_id:
        q = q.filter(MakeupClass.subject_id == subject_id)
    
    if teacher_id:
        q = q.filter(MakeupClass.teacher_id == teacher_id)
    
    makeup_classes = q.order_by(MakeupClass.created_at.desc()).all()
    
    result = []
    for mc in makeup_classes:
        # Get enrolled students
        enrollments = db.query(MakeupEnrollment).filter(
            MakeupEnrollment.makeup_class_id == mc.id
        ).all()
        
        students = []
        for enrollment in enrollments:
            if enrollment.student:
                students.append({
                    "id": enrollment.student.id,
                    "roll_number": enrollment.student.roll_number,
                    "name": enrollment.student.name
                })
        
        result.append({
            "id": mc.id,
            "session_id": mc.session_id,
            "session_name": mc.session.name if mc.session else None,
            "subject_id": mc.subject_id,
            "subject_code": mc.subject.code if mc.subject else None,
            "subject_name": mc.subject.full_name if mc.subject else None,
            "teacher_id": mc.teacher_id,
            "teacher_name": mc.teacher.name if mc.teacher else None,
            "room_id": mc.room_id,
            "room_name": mc.room.name if mc.room else None,
            "department_id": mc.department_id,
            "department_name": mc.department.name if mc.department else None,
            "reason": mc.reason,
            "original_date": str(mc.original_date) if mc.original_date else None,
            "is_lab": mc.is_lab,
            "lab_engineer_id": mc.lab_engineer_id,
            "lab_engineer_name": mc.lab_engineer.name if mc.lab_engineer else None,
            "created_at": str(mc.created_at),
            "students": students,
            "student_count": len(students)
        })
    
    return result


# ── Get Makeup Class ─────────────────────────────────────────────
@router.get("/{makeup_id}")
def get_makeup_class(makeup_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get makeup class details"""
    mc = db.query(MakeupClass).filter(MakeupClass.id == makeup_id).first()
    if not mc:
        raise HTTPException(404, "Makeup class not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != mc.department_id:
        raise HTTPException(403, "Access denied")
    
    # Get enrolled students
    enrollments = db.query(MakeupEnrollment).filter(
        MakeupEnrollment.makeup_class_id == mc.id
    ).all()
    
    students = []
    for enrollment in enrollments:
        if enrollment.student:
            students.append({
                "id": enrollment.student.id,
                "roll_number": enrollment.student.roll_number,
                "name": enrollment.student.name,
                "batch_name": enrollment.student.batch.display_name if enrollment.student.batch else None,
                "section_name": enrollment.student.section.display_name if enrollment.student.section else None
            })
    
    return {
        "id": mc.id,
        "session_id": mc.session_id,
        "session_name": mc.session.name if mc.session else None,
        "subject_id": mc.subject_id,
        "subject_code": mc.subject.code if mc.subject else None,
        "subject_name": mc.subject.full_name if mc.subject else None,
        "teacher_id": mc.teacher_id,
        "teacher_name": mc.teacher.name if mc.teacher else None,
        "room_id": mc.room_id,
        "room_name": mc.room.name if mc.room else None,
        "department_id": mc.department_id,
        "department_name": mc.department.name if mc.department else None,
        "reason": mc.reason,
        "original_date": str(mc.original_date) if mc.original_date else None,
        "is_lab": mc.is_lab,
        "lab_engineer_id": mc.lab_engineer_id,
        "lab_engineer_name": mc.lab_engineer.name if mc.lab_engineer else None,
        "created_at": str(mc.created_at),
        "students": students
    }


# ── Create Makeup Class ──────────────────────────────────────────
@router.post("/")
def create_makeup_class(
    data: dict,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Create a new makeup class"""
    session_id = data.get("session_id")
    subject_id = data.get("subject_id")
    teacher_id = data.get("teacher_id")
    department_id = data.get("department_id")
    
    if not session_id or not subject_id or not teacher_id or not department_id:
        raise HTTPException(400, "session_id, subject_id, teacher_id, and department_id are required")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != department_id:
        raise HTTPException(403, "You can only create makeup classes for your department")
    
    mc = MakeupClass(
        session_id=session_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        room_id=data.get("room_id"),
        department_id=department_id,
        reason=data.get("reason"),
        original_date=data.get("original_date"),
        is_lab=data.get("is_lab", False),
        lab_engineer_id=data.get("lab_engineer_id"),
        created_by_id=user.id
    )
    
    db.add(mc)
    db.commit()
    db.refresh(mc)
    
    return {
        "id": mc.id,
        "session_id": mc.session_id,
        "subject_id": mc.subject_id,
        "teacher_id": mc.teacher_id,
        "room_id": mc.room_id,
        "department_id": mc.department_id,
        "reason": mc.reason,
        "original_date": str(mc.original_date) if mc.original_date else None,
        "is_lab": mc.is_lab,
        "lab_engineer_id": mc.lab_engineer_id
    }


# ── Update Makeup Class ──────────────────────────────────────────
@router.put("/{makeup_id}")
def update_makeup_class(
    makeup_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Update makeup class"""
    mc = db.query(MakeupClass).filter(MakeupClass.id == makeup_id).first()
    if not mc:
        raise HTTPException(404, "Makeup class not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != mc.department_id:
        raise HTTPException(403, "Access denied")
    
    # Update fields
    if "teacher_id" in data:
        mc.teacher_id = data["teacher_id"]
    if "room_id" in data:
        mc.room_id = data["room_id"]
    if "reason" in data:
        mc.reason = data["reason"]
    if "original_date" in data:
        mc.original_date = data["original_date"]
    if "lab_engineer_id" in data:
        mc.lab_engineer_id = data["lab_engineer_id"]
    
    db.commit()
    db.refresh(mc)
    
    return {"ok": True, "message": "Makeup class updated"}


# ── Delete Makeup Class ──────────────────────────────────────────
@router.delete("/{makeup_id}")
def delete_makeup_class(
    makeup_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin"))
):
    """Delete makeup class"""
    mc = db.query(MakeupClass).filter(MakeupClass.id == makeup_id).first()
    if not mc:
        raise HTTPException(404, "Makeup class not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != mc.department_id:
        raise HTTPException(403, "Access denied")
    
    db.delete(mc)
    db.commit()
    
    return {"ok": True, "message": "Makeup class deleted"}


# ── Enroll Student ───────────────────────────────────────────────
@router.post("/{makeup_id}/enroll")
def enroll_student(
    makeup_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Enroll a student in makeup class"""
    student_id = data.get("student_id")
    if not student_id:
        raise HTTPException(400, "student_id is required")
    
    mc = db.query(MakeupClass).filter(MakeupClass.id == makeup_id).first()
    if not mc:
        raise HTTPException(404, "Makeup class not found")
    
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != mc.department_id:
        raise HTTPException(403, "Access denied")
    
    # Check if already enrolled
    existing = db.query(MakeupEnrollment).filter(
        MakeupEnrollment.makeup_class_id == makeup_id,
        MakeupEnrollment.student_id == student_id
    ).first()
    
    if existing:
        raise HTTPException(400, "Student already enrolled")
    
    enrollment = MakeupEnrollment(
        makeup_class_id=makeup_id,
        student_id=student_id
    )
    
    db.add(enrollment)
    db.commit()
    
    return {"ok": True, "message": "Student enrolled"}


# ── Unenroll Student ─────────────────────────────────────────────
@router.delete("/{makeup_id}/enroll/{student_id}")
def unenroll_student(
    makeup_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Remove student from makeup class"""
    mc = db.query(MakeupClass).filter(MakeupClass.id == makeup_id).first()
    if not mc:
        raise HTTPException(404, "Makeup class not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != mc.department_id:
        raise HTTPException(403, "Access denied")
    
    enrollment = db.query(MakeupEnrollment).filter(
        MakeupEnrollment.makeup_class_id == makeup_id,
        MakeupEnrollment.student_id == student_id
    ).first()
    
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")
    
    db.delete(enrollment)
    db.commit()
    
    return {"ok": True, "message": "Student unenrolled"}
