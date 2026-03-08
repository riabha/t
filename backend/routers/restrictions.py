"""
Restrictions endpoints — teacher availability and schedule config.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict

from database import get_db
from models import TeacherRestriction, ScheduleConfig, Teacher, Department, Section, Batch, TeacherDepartmentEngagement
from schemas import (
    TeacherRestrictionCreate, TeacherRestrictionOut, 
    ScheduleConfigCreate, ScheduleConfigOut,
    RestrictionsSummaryOut, RestrictedTeacherSummary, RestrictedSectionSummary
)
from auth import require_role, get_current_user

router = APIRouter(prefix="/api/restrictions", tags=["Restrictions"])


def _check_restrictions_access(user=Depends(get_current_user)):
    """Check that user has permission to manage restrictions."""
    if user.role == "super_admin":
        return user
    if user.role == "program_admin" and user.can_manage_restrictions:
        return user
    raise HTTPException(status_code=403, detail="You do not have permission to manage restrictions")

# ── Teacher Availability ────────────────────────────────────────

@router.get("/teacher/{teacher_id}", response_model=list[TeacherRestrictionOut])
def get_teacher_restrictions(teacher_id: int, db: Session = Depends(get_db), 
                               current_user = Depends(_check_restrictions_access)):
    """Get all unavailable slots for a teacher."""
    return db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == teacher_id).all()

@router.post("/teacher/{teacher_id}", response_model=list[TeacherRestrictionOut])
def set_teacher_restrictions(teacher_id: int, restrictions: list[TeacherRestrictionCreate], 
                               db: Session = Depends(get_db), 
                               current_user = Depends(_check_restrictions_access)):
    """Batch set unavailable slots for a teacher (replaces existing)."""
    # Verify teacher exists
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Clear existing
    db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == teacher_id).delete()
    
    # Add new
    new_restrictions = []
    for r in restrictions:
        new_restrictions.append(TeacherRestriction(
            teacher_id=teacher_id,
            day=r.day,
            slot_index=r.slot_index
        ))
    db.add_all(new_restrictions)
    db.commit()
    return db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == teacher_id).all()


# ── Schedule Config ─────────────────────────────────────────────

@router.get("/config/{section_id}", response_model=ScheduleConfigOut)
def get_schedule_config(section_id: int, db: Session = Depends(get_db), 
                         current_user = Depends(_check_restrictions_access)):
    """Get schedule configuration for a section."""
    config = db.query(ScheduleConfig).filter(ScheduleConfig.section_id == section_id).first()
    if not config:
        # Create default config if not found
        config = ScheduleConfig(section_id=section_id, lab_morning_days=[], no_gaps=True)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.post("/config", response_model=ScheduleConfigOut)
def save_schedule_config(req: ScheduleConfigCreate, db: Session = Depends(get_db), 
                          current_user = Depends(_check_restrictions_access)):
    """Update schedule configuration for a section."""
    config = db.query(ScheduleConfig).filter(ScheduleConfig.section_id == req.section_id).first()
    if config:
        config.lab_morning_days = req.lab_morning_days
        config.no_gaps = req.no_gaps
    else:
        config = ScheduleConfig(
            section_id=req.section_id,
            lab_morning_days=req.lab_morning_days,
            no_gaps=req.no_gaps
        )
        db.add(config)
    
    db.commit()
    db.refresh(config)
    return config


@router.get("/summary", response_model=RestrictionsSummaryOut)
def get_restrictions_summary(department_id: Optional[int] = None, 
                             db: Session = Depends(get_db),
                             current_user = Depends(_check_restrictions_access)):
    """Get a summary of all active restrictions."""
    # Logic to match teachers.py list_teachers:
    # Teachers who are in this dept OR engaged by this dept
    if not department_id:
        # For super admin with no filter, show all restricted teachers
        teachers = db.query(Teacher).all()
    else:
        from sqlalchemy import or_
        q = db.query(Teacher).outerjoin(TeacherDepartmentEngagement).filter(
            or_(
                Teacher.department_id == department_id,
                TeacherDepartmentEngagement.department_id == department_id
            )
        )
        teachers = q.all()
    
    teachers_with_res = []
    # Deduplicate in case of multiple engagements (though rare)
    processed_ids = set()
    for t in teachers:
        if t.id in processed_ids: continue
        processed_ids.add(t.id)
        
        count = db.query(TeacherRestriction).filter(TeacherRestriction.teacher_id == t.id).count()
        if count > 0:
            teachers_with_res.append(RestrictedTeacherSummary(id=t.id, name=t.name, count=count))
            
    # Sections (ScheduleConfig where non-default)
    config_query = db.query(ScheduleConfig).join(Section)
    if department_id:
        config_query = config_query.join(Batch, Section.batch_id == Batch.id).filter(Batch.department_id == department_id)
        
    restricted_sections = []
    all_configs = config_query.all()
    
    DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    
    for c in all_configs:
        # Only include if non-default
        is_restricted = (not c.no_gaps) or (c.lab_morning_days and len(c.lab_morning_days) > 0)
        
        if is_restricted:
            reasons = []
            if not c.no_gaps:
                reasons.append("Gaps Allowed")
            if c.lab_morning_days:
                day_names = [DAYS[d] for d in c.lab_morning_days if d < len(DAYS)]
                reasons.append(f"Morning labs: {', '.join(day_names)}")
                
            restricted_sections.append(RestrictedSectionSummary(
                id=c.section_id,
                name=c.section.display_name,
                reason=" | ".join(reasons)
            ))
    
    return RestrictionsSummaryOut(teachers=teachers_with_res, sections=restricted_sections)
