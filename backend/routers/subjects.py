"""
Subject CRUD endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List
import csv
import io

from database import get_db
from models import Subject
from schemas import SubjectCreate, SubjectOut
from auth import require_role, get_current_user

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


@router.get("/", response_model=list[SubjectOut])
def list_subjects(department_id: int = None, semester: int = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Subject).options(joinedload(Subject.department))
    
    # Department filtering for program_admin
    if user.role == "program_admin" and not department_id:
        department_id = user.department_id
    
    if department_id:
        q = q.filter(Subject.department_id == department_id)
    if semester:
        q = q.filter(Subject.semester == semester)
    subjects = q.order_by(Subject.code).all()
    result = []
    for s in subjects:
        out = SubjectOut.model_validate(s)
        if s.department:
            out.department_name = s.department.name
        result.append(out)
    return result


@router.post("/", response_model=SubjectOut)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin", "clerk"))):
    # Clerk/Program admin can only add subjects in their own department
    if user.role in ("clerk", "program_admin") and user.department_id:
        data = data.model_copy(update={"department_id": user.department_id})
    s = Subject(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return SubjectOut(
        id=s.id, code=s.code, full_name=s.full_name,
        theory_credits=s.theory_credits, lab_credits=s.lab_credits,
        department_id=s.department_id, credit_display=s.credit_display,
    )


@router.put("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: int, data: SubjectCreate,
                   db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin", "clerk"))):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    if user.role in ("clerk", "program_admin") and s.department_id != user.department_id:
        raise HTTPException(403, "You can only manage subjects in your department")
    if user.role in ("clerk", "program_admin") and user.department_id:
        data = data.model_copy(update={"department_id": user.department_id})
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return SubjectOut(
        id=s.id, code=s.code, full_name=s.full_name,
        theory_credits=s.theory_credits, lab_credits=s.lab_credits,
        department_id=s.department_id, credit_display=s.credit_display,
    )


@router.delete("/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin", "clerk"))):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    if user.role == "clerk" and s.department_id != user.department_id:
        raise HTTPException(403, "You can only manage subjects in your department")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.get("/template")
def get_subject_template(db: Session = Depends(get_db),
                         user=Depends(require_role("super_admin", "program_admin", "clerk"))):
    """Return a CSV template for subject bulk upload."""
    # Build a department reference comment
    departments = db.query(Subject).with_entities().from_statement(
        __import__('sqlalchemy').text("SELECT id, code, name FROM departments")
    ).all() if False else []
    
    from models import Department
    depts = db.query(Department).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["code", "full_name", "theory_credits", "lab_credits", "semester", "department_id"])
    
    # Use the user's own department_id as the example value
    dept_id = user.department_id or (depts[0].id if depts else 1)
    dept_name = next((d.name for d in depts if d.id == dept_id), "")
    writer.writerow([f"CE-111", f"Example Subject", "3", "0", "1", str(dept_id)])
    
    # Add a reference row showing all department IDs
    writer.writerow([])
    writer.writerow(["# Department Reference:"])
    for d in depts:
        writer.writerow([f"#  {d.id} = {d.code} ({d.name})"])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=subject_template.csv"}
    )


@router.post("/bulk-upload")
async def bulk_upload_subjects(file: UploadFile = File(...), db: Session = Depends(get_db),
                              user=Depends(require_role("super_admin", "program_admin", "clerk"))):
    """Bulk create subjects from CSV."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files are allowed")
    
    content = await file.read()
    decoded = content.decode('utf-8').splitlines()
    reader = csv.DictReader(decoded)
    
    added_count = 0
    errors = []
    
    for row in reader:
        try:
            # Clerk restriction
            d_id = int(row.get("department_id") or user.department_id)
            if user.role == "clerk" and d_id != user.department_id:
                errors.append(f"Row {added_count + 1}: Cannot add subjects to other departments")
                continue
                
            s = Subject(
                code=row["code"],
                full_name=row["full_name"],
                theory_credits=int(row.get("theory_credits", 3)),
                lab_credits=int(row.get("lab_credits", 0)),
                semester=int(row["semester"]) if row.get("semester") else None,
                department_id=d_id
            )
            db.add(s)
            added_count += 1
        except Exception as e:
            errors.append(f"Row {added_count + 1}: {str(e)}")
            
    db.commit()
    return {"added": added_count, "errors": errors}
