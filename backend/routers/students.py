"""
Student Management API
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import io

from database import get_db
from models import Student, Batch, Section, Department
from auth import require_role, get_current_user

router = APIRouter(prefix="/api/students", tags=["Students"])


# ── List Students ────────────────────────────────────────────────
@router.get("/")
def list_students(
    department_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    section_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """List students with optional filters"""
    q = db.query(Student)
    
    # Filter by department for non-super admins
    if user.role != "super_admin" and user.department_id:
        q = q.filter(Student.department_id == user.department_id)
    elif department_id:
        q = q.filter(Student.department_id == department_id)
    
    if batch_id:
        q = q.filter(Student.batch_id == batch_id)
    
    if section_id:
        q = q.filter(Student.section_id == section_id)
    
    if is_active is not None:
        q = q.filter(Student.is_active == is_active)
    
    students = q.order_by(Student.roll_number).all()
    
    return [{
        "id": s.id,
        "roll_number": s.roll_number,
        "name": s.name,
        "batch_id": s.batch_id,
        "batch_name": s.batch.display_name if s.batch else None,
        "section_id": s.section_id,
        "section_name": s.section.display_name if s.section else None,
        "department_id": s.department_id,
        "department_name": s.department.name if s.department else None,
        "is_active": s.is_active,
        "created_at": str(s.created_at)
    } for s in students]


# ── Get Student ──────────────────────────────────────────────────
@router.get("/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get student details"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != student.department_id:
        raise HTTPException(403, "Access denied")
    
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "name": student.name,
        "batch_id": student.batch_id,
        "batch_name": student.batch.display_name if student.batch else None,
        "section_id": student.section_id,
        "section_name": student.section.display_name if student.section else None,
        "department_id": student.department_id,
        "department_name": student.department.name if student.department else None,
        "is_active": student.is_active,
        "created_at": str(student.created_at)
    }


# ── Create Student ───────────────────────────────────────────────
@router.post("/")
def create_student(
    data: dict,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Create a new student"""
    roll_number = data.get("roll_number")
    name = data.get("name")
    batch_id = data.get("batch_id")
    section_id = data.get("section_id")
    department_id = data.get("department_id")
    
    if not roll_number or not name or not batch_id or not department_id:
        raise HTTPException(400, "roll_number, name, batch_id, and department_id are required")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != department_id:
        raise HTTPException(403, "You can only create students for your department")
    
    # Check if roll number already exists
    existing = db.query(Student).filter(Student.roll_number == roll_number).first()
    if existing:
        raise HTTPException(400, f"Student with roll number '{roll_number}' already exists")
    
    student = Student(
        roll_number=roll_number,
        name=name,
        batch_id=batch_id,
        section_id=section_id,
        department_id=department_id,
        is_active=data.get("is_active", True)
    )
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "name": student.name,
        "batch_id": student.batch_id,
        "section_id": student.section_id,
        "department_id": student.department_id,
        "is_active": student.is_active
    }


# ── Update Student ───────────────────────────────────────────────
@router.put("/{student_id}")
def update_student(
    student_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """Update student information"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != student.department_id:
        raise HTTPException(403, "Access denied")
    
    # Update fields
    if "name" in data:
        student.name = data["name"]
    if "batch_id" in data:
        student.batch_id = data["batch_id"]
    if "section_id" in data:
        student.section_id = data["section_id"]
    if "is_active" in data:
        student.is_active = data["is_active"]
    
    db.commit()
    db.refresh(student)
    
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "name": student.name,
        "batch_id": student.batch_id,
        "section_id": student.section_id,
        "department_id": student.department_id,
        "is_active": student.is_active
    }


# ── Delete Student ───────────────────────────────────────────────
@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin"))
):
    """Delete a student"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    
    # Check permission
    if user.role != "super_admin" and user.department_id != student.department_id:
        raise HTTPException(403, "Access denied")
    
    db.delete(student)
    db.commit()
    
    return {"ok": True, "message": "Student deleted"}


# ── Bulk Upload Students ─────────────────────────────────────────
@router.post("/upload")
async def upload_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(require_role("super_admin", "program_admin", "clerk"))
):
    """
    Upload students from CSV file
    
    CSV Format:
    roll_number,name,batch_id,section_id,department_id
    CE-22-001,John Doe,1,1,1
    CE-22-002,Jane Smith,1,1,1
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    content = await file.read()
    csv_data = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_data))
    
    created = 0
    skipped = 0
    errors = []
    
    for row in csv_reader:
        try:
            roll_number = row.get('roll_number', '').strip()
            name = row.get('name', '').strip()
            batch_id = int(row.get('batch_id', 0))
            section_id = row.get('section_id', '').strip()
            department_id = int(row.get('department_id', 0))
            
            if not roll_number or not name or not batch_id or not department_id:
                errors.append(f"Row skipped: Missing required fields for {roll_number or 'unknown'}")
                skipped += 1
                continue
            
            # Check permission
            if user.role != "super_admin" and user.department_id != department_id:
                errors.append(f"Row skipped: No permission for department {department_id}")
                skipped += 1
                continue
            
            # Check if exists
            existing = db.query(Student).filter(Student.roll_number == roll_number).first()
            if existing:
                errors.append(f"Row skipped: Roll number {roll_number} already exists")
                skipped += 1
                continue
            
            # Create student
            student = Student(
                roll_number=roll_number,
                name=name,
                batch_id=batch_id,
                section_id=int(section_id) if section_id else None,
                department_id=department_id,
                is_active=True
            )
            db.add(student)
            created += 1
            
        except Exception as e:
            errors.append(f"Error processing row: {str(e)}")
            skipped += 1
    
    db.commit()
    
    return {
        "created": created,
        "skipped": skipped,
        "errors": errors
    }


# ── Download Template ────────────────────────────────────────────
@router.get("/template/download")
def download_template():
    """Download CSV template for student upload"""
    from fastapi.responses import StreamingResponse
    
    csv_content = "roll_number,name,batch_id,section_id,department_id\n"
    csv_content += "CE-22-001,John Doe,1,1,1\n"
    csv_content += "CE-22-002,Jane Smith,1,2,1\n"
    
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_template.csv"}
    )
