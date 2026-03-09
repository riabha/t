"""
Department CRUD + Batch/Section management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
from models import Department, Batch, Section, Room
from schemas import (
    DepartmentCreate, DepartmentOut,
    BatchCreate, BatchOut,
    SectionCreate, SectionOut,
)
from auth import get_current_user, require_role

router = APIRouter(prefix="/api/departments", tags=["Departments"])


# ── Departments ─────────────────────────────────────────────────
@router.get("/", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()


@router.post("/", response_model=DepartmentOut)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db),
                      user=Depends(require_role("super_admin"))):
    dept = Department(code=data.code, name=data.name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, data: DepartmentCreate,
                      db: Session = Depends(get_db),
                      user=Depends(require_role("super_admin"))):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    dept.code = data.code
    dept.name = data.name
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db),
                      user=Depends(require_role("super_admin"))):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    db.delete(dept)
    db.commit()
    return {"ok": True}


# ── Batches ─────────────────────────────────────────────────────
@router.get("/batches", response_model=list[BatchOut])
def list_batches(department_id: int = None, db: Session = Depends(get_db),
                 user=Depends(get_current_user)):
    q = db.query(Batch).options(joinedload(Batch.department))
    
    # Department filtering
    if department_id:
        q = q.filter(Batch.department_id == department_id)
    elif user.role == "program_admin":
        # Program admins only see their own department's batches
        q = q.filter(Batch.department_id == user.department_id)
    elif user.role not in ("super_admin",):
        # Other non-admin users also filtered by department
        q = q.filter(Batch.department_id == user.department_id)
        
    batches = q.all()
    result = []
    for b in batches:
        result.append(BatchOut(
            id=b.id,
            year=b.year,
            department_id=b.department_id,
            semester=b.semester,
            department_code=b.department.code,
            display_name=b.display_name,
            morning_lab_mode=b.morning_lab_mode,
            morning_lab_count=b.morning_lab_count,
            morning_lab_days=b.morning_lab_days if b.morning_lab_days else []
        ))
    return result


@router.post("/batches", response_model=BatchOut)
def create_batch(data: BatchCreate, db: Session = Depends(get_db),
                 user=Depends(require_role("super_admin", "program_admin"))):
    # Check for duplicate batch
    existing = db.query(Batch).filter(
        Batch.year == data.year,
        Batch.department_id == data.department_id
    ).first()
    if existing:
        raise HTTPException(400, f"Batch {data.year} already exists for this department")
    
    batch = Batch(
        year=data.year, 
        department_id=data.department_id,
        semester=data.semester,
        morning_lab_mode=data.morning_lab_mode,
        morning_lab_count=data.morning_lab_count,
        morning_lab_days=data.morning_lab_days if data.morning_lab_days else []
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return BatchOut(
        id=batch.id, 
        year=batch.year,
        department_id=batch.department_id, 
        semester=batch.semester,
        department_code=batch.department.code,
        display_name=batch.display_name,
        morning_lab_mode=batch.morning_lab_mode,
        morning_lab_count=batch.morning_lab_count,
        morning_lab_days=batch.morning_lab_days if batch.morning_lab_days else []
    )


@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db),
                 user=Depends(require_role("super_admin", "program_admin"))):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")
    db.delete(batch)
    db.commit()
    return {"ok": True}


@router.put("/batches/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, data: BatchCreate, db: Session = Depends(get_db),
                 user=Depends(require_role("super_admin", "program_admin"))):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")
    
    # Validate morning lab configuration
    if data.morning_lab_mode and data.morning_lab_mode not in [None, "strict", "prefer", "count"]:
        raise HTTPException(400, "Invalid morning_lab_mode. Must be null, 'strict', 'prefer', or 'count'")
    
    if data.morning_lab_mode == "count" and (data.morning_lab_count is None or data.morning_lab_count < 1):
        raise HTTPException(400, "morning_lab_count must be set and >= 1 when mode is 'count'")
    
    if data.morning_lab_days:
        if not all(0 <= day <= 4 for day in data.morning_lab_days):
            raise HTTPException(400, "morning_lab_days must contain valid day indices [0-4]")
    
    # Update basic fields
    batch.year = data.year
    batch.semester = data.semester
    batch.department_id = data.department_id
    
    # Update morning lab configuration (NON-DESTRUCTIVE: only updates if provided)
    batch.morning_lab_mode = data.morning_lab_mode
    batch.morning_lab_count = data.morning_lab_count
    batch.morning_lab_days = data.morning_lab_days if data.morning_lab_days else []
    
    db.commit()
    db.refresh(batch)
    return BatchOut(
        id=batch.id,
        year=batch.year,
        department_id=batch.department_id,
        semester=batch.semester,
        department_code=batch.department.code,
        display_name=batch.display_name,
        morning_lab_mode=batch.morning_lab_mode,
        morning_lab_count=batch.morning_lab_count,
        morning_lab_days=batch.morning_lab_days if batch.morning_lab_days else []
    )


# ── Sections ────────────────────────────────────────────────────
@router.get("/sections", response_model=list[SectionOut])
def list_sections(batch_id: int = None, db: Session = Depends(get_db),
                  user=Depends(get_current_user)):
    q = db.query(Section).join(Batch).options(
        joinedload(Section.batch).joinedload(Batch.department)
    )
    
    # Department filtering
    if not batch_id and user.role == "program_admin":
        # Program admins only see their own department's sections
        q = q.filter(Batch.department_id == user.department_id)
    elif not batch_id and user.role not in ("super_admin",):
        # Other non-admin users also filtered by department
        q = q.filter(Batch.department_id == user.department_id)
    
    if batch_id:
        q = q.filter(Section.batch_id == batch_id)
        
    sections = q.all()
    result = []
    for s in sections:
        result.append(SectionOut(
            id=s.id, name=s.name, batch_id=s.batch_id,
            room_id=s.room_id,
            display_name=s.display_name,
        ))
    return result


@router.post("/sections", response_model=SectionOut)
def create_section(data: SectionCreate, db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin"))):
    section = Section(name=data.name, batch_id=data.batch_id, room_id=data.room_id)
    db.add(section)
    db.commit()
    db.refresh(section)
    return SectionOut(id=section.id, name=section.name,
                      batch_id=section.batch_id, room_id=section.room_id,
                      display_name=section.display_name)


@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(section_id: int, data: SectionCreate, db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin"))):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    
    section.name = data.name
    section.batch_id = data.batch_id
    section.room_id = data.room_id
    
    db.commit()
    db.refresh(section)
    return SectionOut(id=section.id, name=section.name,
                      batch_id=section.batch_id, room_id=section.room_id,
                      display_name=section.display_name)


@router.delete("/sections/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db),
                   user=Depends(require_role("super_admin", "program_admin"))):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    db.delete(section)
    db.commit()
    return {"ok": True}
