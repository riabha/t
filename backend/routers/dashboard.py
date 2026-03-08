from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from models import Teacher, Subject, Room, Timetable, Department, Assignment, AssignmentSession, Batch
from schemas import DashboardSummaryOut, DeptWorkload, TimetableOut, TeacherWorkloadSummary, SubjectDistribution
from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Filter by department for program_admin users
    is_program_admin = current_user.role == "program_admin"
    user_dept_id = current_user.department_id if is_program_admin else None
    
    # 1. Basic Stats
    if is_program_admin and user_dept_id:
        stats = {
            "teachers": db.query(Teacher).filter(Teacher.department_id == user_dept_id).count(),
            "subjects": db.query(Subject).filter(Subject.department_id == user_dept_id).count(),
            "rooms": db.query(Room).count(),  # Rooms are shared across departments
            "timetables": db.query(Timetable).filter(Timetable.created_by_id == current_user.id).count()
        }
    else:
        stats = {
            "teachers": db.query(Teacher).count(),
            "subjects": db.query(Subject).count(),
            "rooms": db.query(Room).count(),
            "timetables": db.query(Timetable).count()
        }

    # 2. Recent Timetables
    if is_program_admin:
        recent_tts = db.query(Timetable).filter(
            Timetable.created_by_id == current_user.id
        ).order_by(Timetable.created_at.desc()).limit(5).all()
    else:
        recent_tts = db.query(Timetable).order_by(Timetable.created_at.desc()).limit(5).all()
    
    # 3. Workload Distribution (Department-wise)
    workload = []
    if is_program_admin and user_dept_id:
        # Show only their department
        depts = db.query(Department).filter(Department.id == user_dept_id).all()
    else:
        # Show all departments for super_admin
        depts = db.query(Department).all()
        
    for d in depts:
        total_hours = 0
        distinct_subject_ids = db.query(Assignment.subject_id).join(Subject).filter(Subject.department_id == d.id).distinct().all()
        for (sid,) in distinct_subject_ids:
            subj = db.query(Subject).get(sid)
            if subj:
                # Lab credits: each lab credit = 3 contact hours
                total_hours += (subj.theory_credits + (subj.lab_credits * 3))
        
        workload.append(DeptWorkload(dept_code=d.code, total_hours=float(total_hours)))

    # 4. Teacher Workload Details (for program_admin only)
    teacher_workload = []
    if is_program_admin and user_dept_id:
        # Get active (non-archived) session for this department
        # Sessions are now university-wide, so we find sessions with assignments in this department
        active_session = db.query(AssignmentSession).join(
            Assignment, AssignmentSession.id == Assignment.session_id
        ).join(
            Batch, Assignment.batch_id == Batch.id
        ).filter(
            Batch.department_id == user_dept_id,
            AssignmentSession.is_archived == False
        ).first()
        
        teachers = db.query(Teacher).filter(Teacher.department_id == user_dept_id).all()
        for t in teachers:
            total_hours = 0
            
            # Count theory assignments (only from active session)
            theory_query = db.query(Assignment).filter(Assignment.teacher_id == t.id)
            if active_session:
                theory_query = theory_query.filter(Assignment.session_id == active_session.id)
            theory_assignments = theory_query.all()
            
            for a in theory_assignments:
                subj = db.query(Subject).get(a.subject_id)
                if subj:
                    # Only add theory credits for theory teachers
                    total_hours += subj.theory_credits
            
            # Count lab engineer assignments (lab_credits * 3 hours per section, only from active session)
            lab_query = db.query(Assignment).filter(Assignment.lab_engineer_id == t.id)
            if active_session:
                lab_query = lab_query.filter(Assignment.session_id == active_session.id)
            lab_assignments = lab_query.all()
            
            for a in lab_assignments:
                subj = db.query(Subject).get(a.subject_id)
                if subj:
                    num_sections = len(a.section_ids) if a.section_ids else 0
                    # Lab credits: each lab credit = 3 contact hours
                    total_hours += (subj.lab_credits * 3 * num_sections)
            
            utilization = (total_hours / t.max_contact_hours * 100) if t.max_contact_hours > 0 else 0
            
            teacher_workload.append(TeacherWorkloadSummary(
                id=t.id,
                name=t.name,
                current_hours=float(total_hours),
                max_hours=t.max_contact_hours,
                utilization=round(utilization, 1),
                assignments_count=len(theory_assignments) + len(lab_assignments)
            ))
        
        # Sort by utilization descending
        teacher_workload.sort(key=lambda x: x.utilization, reverse=True)
    
    # 5. Subject Distribution by Semester (for program_admin only)
    subject_distribution = []
    if is_program_admin and user_dept_id:
        subjects_by_sem = db.query(
            Subject.semester, 
            func.count(Subject.id)
        ).filter(
            Subject.department_id == user_dept_id
        ).group_by(Subject.semester).all()
        
        for sem, count in subjects_by_sem:
            subject_distribution.append(SubjectDistribution(
                semester=sem,
                count=count
            ))
        
        # Sort by semester
        subject_distribution.sort(key=lambda x: x.semester if x.semester else 0)
    
    # 6. Assignment Coverage (for program_admin only)
    assignment_coverage = None
    if is_program_admin and user_dept_id:
        total_subjects = db.query(Subject).filter(Subject.department_id == user_dept_id).count()
        assigned_subjects = db.query(Assignment.subject_id).join(Subject).filter(
            Subject.department_id == user_dept_id
        ).distinct().count()
        
        percentage = (assigned_subjects / total_subjects * 100) if total_subjects > 0 else 0
        assignment_coverage = {
            "assigned": assigned_subjects,
            "total": total_subjects,
            "percentage": round(percentage, 1)
        }
    
    # 7. Teacher Utilization Summary (for program_admin only)
    teacher_utilization = None
    if is_program_admin and user_dept_id:
        underutilized = sum(1 for t in teacher_workload if t.utilization < 50)
        optimal = sum(1 for t in teacher_workload if 50 <= t.utilization <= 90)
        overloaded = sum(1 for t in teacher_workload if t.utilization > 90)
        
        teacher_utilization = {
            "underutilized": underutilized,
            "optimal": optimal,
            "overloaded": overloaded
        }

    return DashboardSummaryOut(
        stats=stats,
        recent_timetables=recent_tts,
        workload_distribution=workload,
        teacher_workload=teacher_workload,
        subject_distribution=subject_distribution,
        assignment_coverage=assignment_coverage,
        teacher_utilization=teacher_utilization
    )
