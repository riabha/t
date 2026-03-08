"""
Export all data from SQLite database to JSON for migration to PostgreSQL.
Run this on your LOCAL machine before deploying.
"""
import json
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    User, Department, Teacher, Subject, Room, Section, 
    Assignment, Restriction, Timetable, TimetableSlot, UniversitySession
)

def export_data():
    db = SessionLocal()
    
    try:
        data = {
            'users': [],
            'departments': [],
            'teachers': [],
            'subjects': [],
            'rooms': [],
            'sections': [],
            'assignments': [],
            'restrictions': [],
            'timetables': [],
            'timetable_slots': [],
            'university_sessions': []
        }
        
        # Export Users
        for user in db.query(User).all():
            data['users'].append({
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'email': user.email,
                'hashed_password': user.hashed_password,
                'role': user.role,
                'department_id': user.department_id,
                'is_active': user.is_active
            })
        
        # Export Departments
        for dept in db.query(Department).all():
            data['departments'].append({
                'id': dept.id,
                'name': dept.name,
                'code': dept.code
            })
        
        # Export Teachers
        for teacher in db.query(Teacher).all():
            data['teachers'].append({
                'id': teacher.id,
                'name': teacher.name,
                'email': teacher.email,
                'department_id': teacher.department_id,
                'is_lab_engineer': teacher.is_lab_engineer
            })
        
        # Export Subjects
        for subject in db.query(Subject).all():
            data['subjects'].append({
                'id': subject.id,
                'name': subject.name,
                'code': subject.code,
                'credits': subject.credits,
                'is_lab': subject.is_lab,
                'department_id': subject.department_id
            })
        
        # Export Rooms
        for room in db.query(Room).all():
            data['rooms'].append({
                'id': room.id,
                'name': room.name,
                'capacity': room.capacity,
                'is_lab': room.is_lab,
                'department_id': room.department_id
            })
        
        # Export Sections
        for section in db.query(Section).all():
            data['sections'].append({
                'id': section.id,
                'name': section.name,
                'batch_id': section.batch_id,
                'department_id': section.department_id,
                'semester': section.semester,
                'student_count': section.student_count
            })
        
        # Export Assignments
        for assignment in db.query(Assignment).all():
            data['assignments'].append({
                'id': assignment.id,
                'teacher_id': assignment.teacher_id,
                'subject_id': assignment.subject_id,
                'section_id': assignment.section_id,
                'lab_engineer_id': assignment.lab_engineer_id
            })
        
        # Export Restrictions
        for restriction in db.query(Restriction).all():
            data['restrictions'].append({
                'id': restriction.id,
                'teacher_id': restriction.teacher_id,
                'day': restriction.day,
                'slot_index': restriction.slot_index,
                'is_strict': restriction.is_strict
            })
        
        # Export University Sessions
        for session in db.query(UniversitySession).all():
            data['university_sessions'].append({
                'id': session.id,
                'name': session.name,
                'start_time': session.start_time,
                'slot_duration': session.slot_duration,
                'total_slots': session.total_slots,
                'break_slots': session.break_slots,
                'is_active': session.is_active
            })
        
        # Export Timetables
        for tt in db.query(Timetable).all():
            data['timetables'].append({
                'id': tt.id,
                'name': tt.name,
                'department_id': tt.department_id,
                'batch_id': tt.batch_id,
                'status': tt.status,
                'created_at': tt.created_at.isoformat() if tt.created_at else None,
                'updated_at': tt.updated_at.isoformat() if tt.updated_at else None,
                'session_id': tt.session_id,
                'allow_morning_labs': tt.allow_morning_labs
            })
        
        # Export Timetable Slots
        for slot in db.query(TimetableSlot).all():
            data['timetable_slots'].append({
                'id': slot.id,
                'timetable_id': slot.timetable_id,
                'section_id': slot.section_id,
                'day': slot.day,
                'slot_index': slot.slot_index,
                'subject_id': slot.subject_id,
                'teacher_id': slot.teacher_id,
                'room_id': slot.room_id,
                'is_lab': slot.is_lab,
                'is_break': slot.is_break,
                'lab_engineer_id': slot.lab_engineer_id
            })
        
        # Save to JSON file
        with open('data_export.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print("✅ Data export completed successfully!")
        print(f"📊 Exported:")
        print(f"   - {len(data['users'])} users")
        print(f"   - {len(data['departments'])} departments")
        print(f"   - {len(data['teachers'])} teachers")
        print(f"   - {len(data['subjects'])} subjects")
        print(f"   - {len(data['rooms'])} rooms")
        print(f"   - {len(data['sections'])} sections")
        print(f"   - {len(data['assignments'])} assignments")
        print(f"   - {len(data['restrictions'])} restrictions")
        print(f"   - {len(data['university_sessions'])} university sessions")
        print(f"   - {len(data['timetables'])} timetables")
        print(f"   - {len(data['timetable_slots'])} timetable slots")
        print(f"\n📁 File saved as: data_export.json")
        
    except Exception as e:
        print(f"❌ Error during export: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    export_data()
