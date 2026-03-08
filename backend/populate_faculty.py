
import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Teacher, Subject, Batch, Section, Assignment, Department, AssignmentSession

DB_DATA = [
    # Professors
    ("Prof. Dr. Daddan Khan Bangwar", "Professor", [
        ("Reinforced and Pre-stressed Concrete (Th)", "23CE", ["C"])
    ]),
    ("Prof. Dr. Bashir Ahmed Memon", "Professor", [
        ("Modern Methods of Structural Analysis (Th)", "23CE", ["A"]),
        ("Engineering Mechanics (Th)", "25CE", ["A"])
    ]),
    ("Prof. Dr. Ahsan Ali Buriro", "Professor", [
        ("Reinforced and Pre-stressed Concrete (Th)", "23CE", ["A", "B"])
    ]),
    ("Prof. Dr. Riaz Bhanbhro", "Professor", [
        ("Soil Mechanics (Th)", "23CE", ["A", "B", "C"])
    ]),
    ("Prof. Dr. Aftab Hameed Memon", "Professor", [
        ("Quantity Surveying & Estimation for Civil Works (Th)", "22CE", ["A", "C"])
    ]),
    # Associate Professors
    ("Dr. Nadeem Karim Bhatti", "Associate Professor", [
        ("Environmental Engineering-II (Th)", "22CE", ["A", "B", "C"]),
        ("Environmental Engineering (Th)", "24CET", ["A"]) # Assuming A if not specified for CET
    ]),
    ("Dr. Jam Shahzaib Khan Sahito", "Associate Professor", [
        ("Project Planning, Economics & Management (Th)", "22CE", ["A", "B", "C"]),
        ("Project Management (Th)", "23CET", ["A"])
    ]),
    # Assistant Professors
    ("Engr. Ubaidullah Memon", "Assistant Professor", [
        ("Engineering Economics (Th)", "24CE", ["A", "B", "C"]),
        ("Transportation Engineering (Th)", "24CET", ["A"])
    ]),
    ("Dr. Mahboob Oad", "Assistant Professor", [
        ("Modern Methods of Structural Analysis (Th)", "23CE", ["B", "C"]),
        ("Civil Engineering Drawing & Graphics (Th)", "25CE", ["A", "B", "C"])
    ]),
    ("Dr. Muneeb Ayoub Memon", "Assistant Professor", [
        ("Steel Structures (Th)", "23CE", ["A", "B", "C"]),
        ("Steel Structures (Th)", "23CET", ["A"])
    ]),
    ("Dr. Shahnawaz Zardari", "Assistant Professor", [
        ("Hydrology & Water Storage Structures (Th)", "23CE", ["A", "B", "C"]),
        ("Water Supply & Waste Water Management (Th)", "24CET", ["A"])
    ]),
    ("Dr. Aamir Khan Mastoi", "Assistant Professor", [
        ("Soil Mechanics (Th)", "24CE", ["A", "B", "C"]),
        ("Surveying", "25CET", ["A"]),
        ("Theory of Structures (Th)", "24CET", ["A"])
    ]),
    # Lecturers
    ("Engr. Aijaz Ali Dahri", "Lecturer", [
        ("Foundation Engineering (Th)", "22CE", ["A", "B", "C"]),
        ("Geology for Engineers (Th)", "25CE", ["A", "B", "C"]),
        ("Geology", "25CET", ["A"])
    ]),
    ("Engr. Imran Ali Channa", "Lecturer", [
        ("Mechanics of Solids-II (Th)", "24CE", ["A", "B", "C"]),
        ("Mechanics of Solids-II (Th)", "25EL", ["A", "B"])
    ]),
    ("Engr. Faizyab Latif", "Lecturer", [
        ("Professional Ethics (Th)", "24CE", ["A", "B", "C"]),
        ("Engineering Mechanics (Th)", "25CE", ["B", "C"]),
        ("Geology and Earthquake Engineering (Th)", "23CET", ["A"])
    ]),
    ("Engr. Ubaidullah Khan", "Lecturer", [
        ("Quantity Surveying & Estimation (Th)", "22CE", ["B"]),
        ("Advanced Fluid Mechanics (Th)", "24CE", ["A", "B", "C"]),
        ("Irrigation/Hydraulic Structures (Th)", "23CET", ["A"])
    ]),
    # Lab Staff
    ("Dr. Abdul Qadir Memon", "Lab Engineer", [
        ("Soil Mechanics (Pr)", "23CE", ["A", "B", "C"])
    ]),
    ("Engr. Natees Altaf Memon", "Lab Engineer", [
        ("Reinforced/Pre-stressed Concrete", "23CE", ["A", "B", "C"]),
        ("Prestressed/Precast Concrete", "23CET", ["A"])
    ]),
    ("Engr. Imran Hussain Wagan", "Lab Engineer", [
        ("Environmental Engineering-II", "22CE", ["A", "B", "C"]),
        ("Transportation Engineering", "24CET", ["A"])
    ]),
    ("Engr. Ghulam Nabi Keerio", "Lab Engineer", [
        ("Hydrology and Water Storage Structures (Pr)", "23CE", ["A", "B", "C"])
    ]),
    ("Engr. Masroor Hassan Memon", "Lab Supervisor", [
        ("Mechanics of Solids-II", "24CE", ["A", "B", "C"]),
        ("Theory of Structures", "24CET", ["A"])
    ]),
    ("Mr. Rizwan Ahmed Memon", "Lab Instructor", [
        ("Engineering Surveying", "25CE", ["A", "B", "C"]), # Assuming ABC if not specified
        ("Surveying-II", "24BAE", ["A"]),
        ("Surveying", "25CET", ["A"])
    ]),
]

def populate():
    db = SessionLocal()
    try:
        # Create a new session
        session = db.query(AssignmentSession).filter(AssignmentSession.name == "Faculty Assignments 2026").first()
        if not session:
            session = AssignmentSession(name="Faculty Assignments 2026", department_id=1)
            db.add(session)
            db.commit()
            db.refresh(session)
        
        dept_map = {d.code: d for d in db.query(Department).all()}
        
        # We'll group assignments by (SubjectCleaned, BatchCode, SectionTuple)
        # to merge Theory and Lab teachers into one Assignment if they match perfectly.
        grouped_tasks = {} # (sub_clean, batch_code, sec_tuple) -> { 'th': teacher_id, 'lab': teacher_id }

        for tname, desig, asgns in DB_DATA:
            # 1. Get/Create Teacher
            teacher = db.query(Teacher).filter(Teacher.name == tname).first()
            is_lab_staff = "Lab" in desig or "Supervisor" in desig or "Instructor" in desig
            if not teacher:
                teacher = Teacher(name=tname, designation=desig, department_id=1, is_lab_engineer=is_lab_staff)
                db.add(teacher)
                db.commit()
                db.refresh(teacher)
            
            for sub_name, batch_code, sec_names in asgns:
                clean_sub = sub_name.replace("(Th)", "").replace("(Pr)", "").strip()
                sec_tuple = tuple(sorted(sec_names))
                key = (clean_sub, batch_code, sec_tuple)
                
                if key not in grouped_tasks:
                    grouped_tasks[key] = {'th': None, 'lab': None, 'is_pr_sub': False}
                
                is_p = "(Pr)" in sub_name or is_lab_staff or "Practical" in sub_name
                if is_p:
                    grouped_tasks[key]['lab'] = teacher.id
                    grouped_tasks[key]['is_pr_sub'] = True
                else:
                    grouped_tasks[key]['th'] = teacher.id

        for (clean_sub, batch_code, sec_tuple), teachers in grouped_tasks.items():
            # Parse batch
            year_str = "".join([c for c in batch_code if c.isdigit()])
            dept_code = "".join([c for c in batch_code if not c.isdigit()])
            year = int(year_str) if year_str else 23

            if dept_code not in dept_map:
                new_dept = Department(code=dept_code, name=dept_code)
                db.add(new_dept)
                db.commit()
                db.refresh(new_dept)
                dept_map[dept_code] = new_dept
            
            dept = dept_map[dept_code]

            # Get Batch
            batch = db.query(Batch).filter(Batch.year == year, Batch.department_id == dept.id).first()
            if not batch:
                batch = Batch(year=year, department_id=dept.id)
                db.add(batch)
                db.commit()
                db.refresh(batch)
            
            # Get Sections
            active_sec_ids = []
            for sname in sec_tuple:
                sec = db.query(Section).filter(Section.name == sname, Section.batch_id == batch.id).first()
                if not sec:
                    sec = Section(name=sname, batch_id=batch.id)
                    db.add(sec)
                    db.commit()
                    db.refresh(sec)
                active_sec_ids.append(sec.id)

            # Get/Create Subject
            subject = db.query(Subject).filter(Subject.full_name == clean_sub).first()
            if not subject:
                code = "".join([w[0] for w in clean_sub.split() if w[0].isalnum()]).upper()[:10]
                # Default credits: if we have both th and lab teachers, set 3+1
                th_c = 3 if teachers['th'] else 0
                lab_c = 1 if teachers['lab'] or teachers['is_pr_sub'] else 0
                subject = Subject(full_name=clean_sub, code=code, department_id=dept.id,
                                 theory_credits=th_c, lab_credits=lab_c)
                db.add(subject)
                db.commit()
                db.refresh(subject)
            else:
                # Update credits if needed
                if teachers['th'] and subject.theory_credits == 0:
                    subject.theory_credits = 3
                if (teachers['lab'] or teachers['is_pr_sub']) and subject.lab_credits == 0:
                    subject.lab_credits = 1
                db.commit()

            # Create Assignment
            # If we only have a lab teacher, we MUST still set teacher_id (database constraint)
            main_teacher = teachers['th'] if teachers['th'] else teachers['lab']
            
            asgn = Assignment(
                session_id=session.id,
                subject_id=subject.id,
                batch_id=batch.id,
                section_ids=active_sec_ids,
                teacher_id=main_teacher,
                lab_engineer_id=teachers['lab']
            )
            db.add(asgn)
            db.commit()

        print("Population complete.")

    finally:
        db.close()

if __name__ == "__main__":
    sys.path.append(os.getcwd())
    populate()
