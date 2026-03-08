"""
Public (no-auth) timetable endpoints — visible to everyone.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict

from database import get_db
from models import (
    Timetable, TimetableSlot, Section, Subject, Teacher,
    Batch, Department, Room,
)

router = APIRouter(prefix="/api/public", tags=["Public"])


def _slot_dict(s: TimetableSlot, section_name: str = None):
    return {
        "id": s.id,
        "day": s.day,
        "slot_index": s.slot_index,
        "section_id": s.section_id,
        "section_name": section_name,
        "subject_id": s.subject_id,
        "subject_code": s.subject.code if s.subject else None,
        "subject_name": s.subject.full_name if s.subject else None,
        "credit_hours": s.subject.theory_credits if s.subject else None,
        "theory_credits": s.subject.theory_credits if s.subject else None,
        "lab_credits": s.subject.lab_credits if s.subject else None,
        "teacher_id": s.teacher_id,
        "teacher_name": s.teacher.name if s.teacher else None,
        "room_id": s.room_id,
        "room_name": s.room.name if s.room else None,
        "is_lab": s.is_lab,
        "lab_engineer_id": s.lab_engineer_id,
        "lab_engineer_name": s.lab_engineer.name if s.lab_engineer else None,
        "is_break": s.is_break,
        "label": s.label,
    }


@router.get("/departments")
def public_departments(db: Session = Depends(get_db)):
    """List all departments — no auth."""
    depts = db.query(Department).all()
    return [{"id": d.id, "code": d.code, "name": d.name} for d in depts]


@router.get("/timetables")
def public_timetable_list(db: Session = Depends(get_db)):
    """List all generated and archived timetables — no auth."""
    tts = db.query(Timetable).filter(
        Timetable.status.in_(["generated", "archived"])
    ).order_by(Timetable.created_at.desc()).all()
    return [
        {"id": t.id, "name": t.name, "created_at": str(t.created_at),
         "status": t.status, "semester_info": t.semester_info,
         "department_id": t.department_id}
        for t in tts
    ]


@router.get("/batches")
def public_batch_list(db: Session = Depends(get_db)):
    """List all batches grouped by department — no auth."""
    batches = db.query(Batch).all()
    # Group by dept
    depts = defaultdict(list)
    for b in batches:
        depts[b.department_id].append({
            "id": b.id,
            "year": b.year,
            "display_name": b.display_name,
            "department_id": b.department_id
        })
    return depts


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Live stats for the landing page — no auth."""
    return {
        "faculty": db.query(Teacher).filter(Teacher.is_lab_engineer == False).count(),
        "courses": db.query(Subject).count(),
        "departments": db.query(Department).count(),
        "dept_codes": [d.code for d in db.query(Department).all()]
    }


@router.get("/teachers")
def public_teachers_list(db: Session = Depends(get_db)):
    """List all teachers — no auth."""
    teachers = db.query(Teacher).filter(Teacher.is_lab_engineer == False).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "designation": t.designation,
            "department_id": t.department_id,
            "department_name": t.department.name if t.department else None,
            "seniority": t.seniority
        }
        for t in teachers
    ]


@router.get("/teachers/{teacher_id}")
def public_teacher_detail(teacher_id: int, db: Session = Depends(get_db)):
    """Get teacher details — no auth."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        return {"error": "Not found"}
    
    return {
        "id": teacher.id,
        "name": teacher.name,
        "designation": teacher.designation,
        "department_id": teacher.department_id,
        "department_name": teacher.department.name if teacher.department else None,
        "seniority": teacher.seniority,
        "max_contact_hours": teacher.max_contact_hours
    }


@router.get("/timetables/{tt_id}/teacher/{teacher_id}")
def public_teacher_schedule(tt_id: int, teacher_id: int, db: Session = Depends(get_db)):
    """Get teacher's schedule for a specific timetable — no auth."""
    tt = db.query(Timetable).filter(Timetable.id == tt_id).first()
    if not tt:
        return {"error": "Timetable not found"}
    
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        return {"error": "Teacher not found"}
    
    # Get all slots for this teacher (both as teacher and lab engineer)
    slots = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_id == tt_id,
        ((TimetableSlot.teacher_id == teacher_id) | (TimetableSlot.lab_engineer_id == teacher_id))
    ).all()
    
    # Get section names
    section_ids = list(set([s.section_id for s in slots if s.section_id]))
    sections = db.query(Section).filter(Section.id.in_(section_ids)).all()
    section_map = {s.id: s.display_name for s in sections}
    
    return {
        "timetable_id": tt_id,
        "timetable_name": tt.name,
        "teacher_id": teacher_id,
        "teacher_name": teacher.name,
        "slots": [_slot_dict(s, section_map.get(s.section_id)) for s in slots],
        "break_slot": tt.break_slot,
        "start_time": tt.start_time,
        "class_duration": tt.class_duration
    }


@router.get("/timetables/{tt_id}")
def public_timetable_detail(tt_id: int, dept_id: int = None, batch_year: int = None, db: Session = Depends(get_db)):
    """Get full timetable grouped by department → section — no auth."""
    tt = db.query(Timetable).filter(Timetable.id == tt_id).first()
    if not tt:
        return {"error": "Not found"}

    query = db.query(TimetableSlot).filter(TimetableSlot.timetable_id == tt_id)
    
    # Apply filters if provided
    if dept_id or batch_year:
        # Join with Section and Batch to filter
        query = query.join(Section).join(Batch)
        if dept_id:
            query = query.filter(Batch.department_id == dept_id)
        if batch_year:
            query = query.filter(Batch.year == batch_year)

    # Pre-fetch sections with batch and department to avoid N+1 queries
    slots = query.order_by(
        TimetableSlot.section_id, TimetableSlot.day, TimetableSlot.slot_index
    ).all()

    # Get all involved section IDs
    section_ids = {s.section_id for s in slots}
    from sqlalchemy.orm import joinedload
    sections_map = {
        sec.id: sec for sec in db.query(Section)
        .options(joinedload(Section.batch).joinedload(Batch.department))
        .filter(Section.id.in_(section_ids))
        .all()
    }

    # Group by department
    departments = {}  # dept_code -> { name, sections: { sec_name -> [slots] } }

    for s in slots:
        sec = sections_map.get(s.section_id)
        if not sec or not sec.batch or not sec.batch.department:
            continue
        dept = sec.batch.department
        dept_key = dept.code

        if dept_key not in departments:
            departments[dept_key] = {
                "id": dept.id,
                "code": dept.code,
                "name": dept.name,
                "sections": {},
            }

        sec_name = sec.display_name
        if sec_name not in departments[dept_key]["sections"]:
            departments[dept_key]["sections"][sec_name] = {
                "section_id": sec.id,
                "name": sec_name,
                "slots": [],
            }

        departments[dept_key]["sections"][sec_name]["slots"].append(
            _slot_dict(s, sec_name)
        )

    # Convert sections dict to list for easier frontend iteration
    result_depts = []
    for dept in departments.values():
        dept["sections"] = list(dept["sections"].values())
        result_depts.append(dept)

    return {
        "id": tt.id,
        "name": tt.name,
        "status": tt.status,
        "created_at": str(tt.created_at),
        "class_duration": tt.class_duration,
        "start_time": tt.start_time,
        "break_start_time": tt.break_start_time,
        "break_end_time": tt.break_end_time,
        "break_slot": tt.break_slot,
        "max_slots_per_day": tt.max_slots_per_day,
        "max_slots_friday": tt.max_slots_friday,
        "friday_has_break": tt.friday_has_break,
        "departments": result_depts,
    }
