"""
Seed script — populates database with real Civil Engineering department data
extracted from the reference Excel files.
"""
from database import engine, SessionLocal, Base
from models import (
    User, Department, Batch, Section, Room, Subject, Teacher, Assignment
)
from auth import hash_password


def seed():
    """Drop all and recreate with seed data."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    # ── Departments ─────────────────────────────────────────────
    ce = Department(code="CE", name="Civil Engineering")
    cet = Department(code="CET", name="Civil Engineering Technology")
    bae = Department(code="BAE", name="Building & Architectural Engineering")
    db.add_all([ce, cet, bae])
    db.flush()

    # ── Batches ─────────────────────────────────────────────────
    batches = {}
    for yr, sem in [(22, 7), (23, 5), (24, 3), (25, 1)]:
        for dept in [ce, cet, bae]:
            b = Batch(year=yr, department_id=dept.id, semester=sem)
            db.add(b)
            db.flush()
            batches[(yr, dept.code)] = b

    # ── Rooms ───────────────────────────────────────────────────
    rooms = {}
    # Create 12 classrooms
    for i in range(1, 13):
        r = Room(name=f"CR-{i:02d}", is_lab=False)
        db.add(r)
        db.flush()
        rooms[i] = r
    
    # Create 6 labs
    for i in range(1, 7):
        r = Room(name=f"Lab-{i}", is_lab=True)
        db.add(r)
        db.flush()
        rooms[12 + i] = r

    # ── Sections ────────────────────────────────────────────────
    sections = {}
    # CE has sections A, B, C for all 4 batches
    room_idx = 1
    for yr in [22, 23, 24, 25]:
        b = batches[(yr, "CE")]
        for sec_name in ["A", "B", "C"]:
            # Only use classrooms (1-12) for sections
            if room_idx <= 12:
                s = Section(name=sec_name, batch_id=b.id, room_id=rooms[room_idx].id)
            else:
                s = Section(name=sec_name, batch_id=b.id, room_id=None)
            db.add(s)
            db.flush()
            sections[(yr, "CE", sec_name)] = s
            room_idx += 1

    # CET and BAE: single section (A)
    for yr in [22, 23, 24, 25]:
        for dept_code in ["CET", "BAE"]:
            b = batches[(yr, dept_code)]
            # Only use classrooms (1-12) for sections
            if room_idx <= 12:
                s = Section(name="A", batch_id=b.id, room_id=rooms[room_idx].id)
            else:
                s = Section(name="A", batch_id=b.id, room_id=None)
            db.add(s)
            db.flush()
            sections[(yr, dept_code, "A")] = s
            room_idx += 1

    # ── Teachers ────────────────────────────────────────────────
    teacher_data = [
        ("Prof. Dr. Daddan Khan Bangwar", "Professor", 6, False),
        ("Prof. Dr. Bashir Ahmed Memon", "Professor", 6, False),
        ("Prof. Dr. Ahsan Ali Buriro", "Professor", 6, False),
        ("Prof. Dr. Riaz Bhanbhro", "Professor", 6, False),
        ("Prof. Dr. Aftab Hameed Memon", "Professor", 6, False),
        ("Dr. Nadeem Karim Bhatti", "Associate Professor", 9, False),
        ("Dr. Jam Shahzaib Khan Sahito", "Associate Professor", 9, False),
        ("Engr. Ubaidullah Memon", "Assistant Professor", 12, False),
        ("Dr. Mahboob Oad", "Assistant Professor", 12, False),
        ("Engr. Naseem Usman Keerio", "Lecturer", 12, False),
        ("Engr. Imran Ali Channa", "Lecturer", 12, False),
        ("Engr. Aijaz Ali Dahri", "Lecturer", 12, False),
        ("Ms. Agha Kousar", "Lecturer", 12, False),
        ("Mr. Hubdar Ali Unar", "Lecturer", 12, False),
        ("Prof. Dr. Saifullah Bhutto", "Professor", 6, False),
        ("Mr. Tarique Keerio", "Lecturer", 12, False),
        ("Mr. Fahad Zardari", "Lecturer", 12, False),
        ("Dr. Aijaz Abbasi", "Associate Professor", 9, False),
        # Lab Engineers
        ("Dr. Abdul Qadir Memon", "Lab Engineer", 15, True),
        ("Engr. Fayaz Taj Memon", "Lab Engineer", 15, True),
        ("Engr. Natees Altaf Memon", "Lab Engineer", 15, True),
        ("Engr. Masroor Ahmed", "Lab Engineer", 15, True),
        ("Engr. Shoaib Ali Dharejo", "Lab Engineer", 15, True),
        ("Engr. Ibrahim Shaikh", "Lab Engineer", 15, True),
    ]

    teachers = {}
    for name, desig, max_hrs, is_lab in teacher_data:
        t = Teacher(name=name, designation=desig, max_contact_hours=max_hrs,
                    department_id=ce.id, is_lab_engineer=is_lab)
        db.add(t)
        db.flush()
        teachers[name] = t
    
    # BAE & CET Teachers
    t_cet = Teacher(name="Engr. CET Expert", designation="Lecturer", max_contact_hours=12, department_id=cet.id)
    t_bae = Teacher(name="Ar. BAE Architect", designation="Assistant Professor", max_contact_hours=12, department_id=bae.id)
    db.add_all([t_cet, t_bae])
    db.flush()
    teachers["CET Expert"] = t_cet
    teachers["BAE Architect"] = t_bae

    # ── Subjects ────────────────────────────────────────────────
    subject_data = [
        # 1st Year, 1st Semester (Term 1)
        ("101", "Civil Engineering Materials", 2, 1, 1, ce.id),
        ("10", "Functional English", 3, 0, 1, ce.id),
        ("11", "Applied Calculus", 3, 0, 1, ce.id),
        ("137", "Engineering Mechanics", 3, 1, 1, ce.id),
        ("12", "Islamic Studies/ Ethics", 2, 0, 1, ce.id),
        ("14", "Pakistan Study", 2, 0, 1, ce.id),
        
        # 1st Year, 2nd Semester (Term 2)
        ("15", "Surveying-I", 3, 1, 2, ce.id),
        ("16", "Engineering Drawing", 2, 1, 2, ce.id),
        ("17", "Computer Fundamentals", 2, 1, 2, ce.id),
        ("102", "Civil Engineering Geology", 2, 0, 2, ce.id),
        ("20", "Linear Algebra & Analytical Geometry", 3, 0, 2, ce.id),
        ("21", "Communication Skills", 3, 0, 2, ce.id),
        
        # 2nd Year, 1st Semester (Term 3)
        ("15-3", "Surveying-I", 3, 1, 3, ce.id), # Numeric code from list was 15 again
        ("23", "Strength of Materials-I", 3, 0, 3, ce.id),
        ("24", "Civil Engineering Drawing", 3, 1, 3, ce.id),
        ("25", "Architecture & Town Planning", 2, 0, 3, ce.id),
        ("26", "Statistics & Probability", 3, 0, 3, ce.id),
        ("114", "Construction Engineering", 2, 0, 3, ce.id),
        
        # 2nd Year, 2nd Semester (Term 4)
        ("32", "Numerical Analysis & Computer Applications", 3, 1, 4, ce.id),
        ("28", "Fluid Mechanics & Hydraulics-I", 3, 1, 4, ce.id),
        ("29", "Strength of Materials-II", 3, 1, 4, ce.id),
        ("30", "Transportation Engineering", 3, 0, 4, ce.id),
        ("31", "Theory of Structures", 3, 0, 4, ce.id),
        
        # 3rd Year, 1st Semester (Term 5)
        ("33", "Fluid Mechanics & Hydraulics-II", 3, 1, 5, ce.id),
        ("34", "Plain & Reinforced Concrete", 3, 1, 5, ce.id),
        ("35", "Highway & Traffic Engineering", 3, 1, 5, ce.id),
        ("36", "Structural Analysis", 3, 0, 5, ce.id),
        ("37", "Engineering Economics", 2, 0, 5, ce.id),
        
        # 3rd Year, 2nd Semester (Term 6)
        ("44", "Reinforced & Pre-stressed Concrete", 3, 1, 6, ce.id),
        ("45", "Hydrology & Water Storage Structures", 3, 1, 6, ce.id),
        ("46", "Steel Structures", 3, 0, 6, ce.id),
        ("47", "Soil Mechanics", 3, 1, 6, ce.id),
        ("48", "Modern Methods of Structural Analysis", 3, 0, 6, ce.id),
        
        # 4th Year, 1st Semester (Term 7)
        ("38", "Structural Design & Drawing", 3, 1, 7, ce.id),
        ("42", "Engineering Environmental-I", 2, 0, 7, ce.id),
        ("43", "Professional Ethics for Engineers", 2, 0, 7, ce.id),
        ("39", "Geotechnical Engineering", 3, 1, 7, ce.id),
        ("40", "Irrigation & Drainage", 3, 1, 7, ce.id),
        
        # 4th Year, 2nd Semester (Term 8)
        ("999", "Project Planning Economics and Management", 3, 0, 8, ce.id),
        ("55", "Final Year Project-II (FYP-II)", 0, 3, 8, ce.id),
        ("50", "Quantity Surveying & Estimation for Civil Works", 3, 0, 8, ce.id),
        ("49", "Environmental Engineering-II", 3, 1, 8, ce.id),
        ("121", "Quantity Surveying Engineering", 2, 1, 8, ce.id),

        # CET Subjects
        # Term 1
        ("CS-100", "Computer fundamentals", 2, 1, 1, cet.id),
        ("CE-203", "Civil Engineering Drawing", 2, 1, 1, cet.id),
        ("CT-124", "Surveying", 3, 1, 1, cet.id),
        ("--3", "System Administration", 3, 1, 1, cet.id),
        ("MTH-101", "Applied Calculus", 3, 0, 1, cet.id),
        ("CM-112", "Occupational Health & safety Management", 2, 0, 1, cet.id),
        # Term 2
        ("MTH-104", "Pakistan Studies", 2, 0, 2, cet.id),
        ("MTH-107", "Functional English", 3, 0, 2, cet.id),
        ("CT-134", "Concrete Technology", 2, 1, 2, cet.id),
        ("CT-144", "Applied Mechanics", 2, 1, 2, cet.id),
        ("CT-154", "Materials and Methods of Construction", 2, 1, 2, cet.id),
        ("MTH-211", "Differential Equation", 3, 0, 2, cet.id),
        # Term 3
        ("CT-243", "Fluid Mechanics", 3, 1, 3, cet.id),
        ("CE-308", "Soil Mechanics", 3, 1, 3, cet.id),
        ("CE-209", "Architecture and Town Planning", 2, 0, 3, cet.id),
        ("MTH-301", "Statistics & Probability", 3, 0, 3, cet.id),
        ("CT-254", "Mechanics of Solids", 3, 1, 3, cet.id),
        # Term 4
        ("MTH-107-4", "Communication Skills", 3, 0, 4, cet.id), # MTH-107 repeated, used as 4 for map
        ("CT-274", "Water Supply & Wastewater Management", 3, 0, 4, cet.id),
        ("CE-303", "Transportation Engineering", 3, 1, 4, cet.id),
        ("CT-31", "Theory of Structures", 3, 0, 4, cet.id),
        # Term 5
        ("CT-313", "Hydrology", 2, 1, 5, cet.id),
        ("CE-407", "Foundations Engineering", 3, 1, 5, cet.id),
        ("CT-323", "Reinforced Concrete Structures", 3, 1, 5, cet.id),
        ("CT-333", "Construction and Hydraulic Machinery", 2, 0, 5, cet.id),
        ("CT-343", "Computer Aided Building Modeling & Design", 2, 0, 5, cet.id),
        ("CT-350", "Professional Ethics for Technologist", 2, 0, 5, cet.id),
        # Term 6
        ("CT-383", "Irrigation and Hydraulic Structures", 2, 1, 6, cet.id),
        ("CT-363", "Pre-stressed & Precast concrete", 3, 1, 6, cet.id),
        ("CT-373", "Geology & Earthquake Engineering", 2, 0, 6, cet.id),
        # Term 7
        ("CT-4103", "Project-II", 0, 3, 7, cet.id),
        ("CT-404", "Building Services", 3, 0, 7, cet.id),
        ("CT-403", "Quantity Surveying and Contract Documents", 3, 1, 7, cet.id),
        ("CT-402", "Entrepreneurship", 3, 0, 7, cet.id),
        ("CT-401", "Economics", 3, 0, 7, cet.id),
        # Term 8
        ("--3-8", "System Administration", 3, 1, 8, cet.id),
        
        # BAE Subjects
        # Term 1
        ("90", "History of Building Technology", 1, 1, 1, bae.id),
        ("286", "Applied Physics", 3, 1, 1, bae.id),
        ("167", "Computer Fundamentals", 2, 1, 1, bae.id),
        ("301", "Engineering Drawing", 0, 1, 1, bae.id),
        ("290", "Functional English", 3, 0, 1, bae.id),
        ("91", "Calculus and Analytical Geometry", 3, 0, 1, bae.id),
        # Term 2
        ("96", "Applied Differential Equations", 3, 0, 2, bae.id),
        ("97", "Pakistan and Islamic Studies", 3, 0, 2, bae.id),
        ("253", "Engineering Mechanics", 2, 0, 2, bae.id),
        ("95", "Construction Materials", 2, 1, 2, bae.id),
        ("98", "Occupational Health and Safety", 1, 0, 2, bae.id),
        ("99", "Fine Arts", 1, 1, 2, bae.id),
        # Term 3
        ("105", "Electrical Systems for Buildings", 2, 1, 3, bae.id),
        ("146", "Fluid Mechanics", 3, 1, 3, bae.id),
        ("102", "Soil Mechanics", 2, 1, 3, bae.id),
        ("215", "Communication Skills", 3, 0, 3, bae.id),
        ("100", "Engineering Surveying-I", 2, 1, 3, bae.id),
        ("403", "Probability & Statistics", 3, 0, 3, bae.id),
        # Term 4
        ("109", "Structural Analysis-I", 3, 0, 4, bae.id),
        ("108", "Engineering Economics", 2, 0, 4, bae.id),
        ("111", "Linear Algebra", 2, 0, 4, bae.id),
        ("123", "Architectural Design-II", 1, 2, 4, bae.id),
        ("106", "Mechanics of Solids", 3, 1, 4, bae.id),
        ("107", "Engineering Surveying-II", 2, 1, 4, bae.id),
        # Term 5
        ("115", "Reinforced Concrete Design-I", 3, 1, 5, bae.id),
        ("113", "Numerical Analysis", 2, 1, 5, bae.id),
        ("114", "Construction Engineering", 2, 0, 5, bae.id),
        ("116", "Environmental Engineering", 2, 1, 5, bae.id),
        ("118", "Environmental Control System", 2, 1, 5, bae.id),
        ("119", "Mechanical Systems for Buildings", 1, 1, 5, bae.id),
        # Term 6
        ("120", "Structural Analysis-II", 2, 0, 6, bae.id),
        ("121", "Quantity Surveying Engineering", 2, 1, 6, bae.id),
        ("237", "Energy Efficiency in Buildings", 3, 0, 6, bae.id),
        ("123-6", "Architectural Design-II", 1, 2, 6, bae.id),
        ("124", "Reinforced Concrete Design-II", 3, 1, 6, bae.id),
        ("125", "Geotechnical and Foundation Engineering", 3, 1, 6, bae.id),
        # Term 7
        ("243", "Project Management", 3, 0, 7, bae.id),
        ("127", "Town Planning", 1, 1, 7, bae.id),
        ("128", "Architectural Design-III", 1, 2, 7, bae.id),
        ("129", "Steel Structures", 3, 0, 7, bae.id),
        ("130", "Professional Ethic", 2, 0, 7, bae.id),
        ("54", "Final Year Project-I (FYP-I)", 0, 3, 7, bae.id),
        # Term 8
        ("131", "Building Safety", 1, 1, 8, bae.id),
        ("132", "Integrated Building Design", 1, 2, 8, bae.id),
        ("133", "Entrepreneurship for Engineers", 2, 0, 8, bae.id),
        ("134", "Structural Dynamics", 3, 0, 8, bae.id),
        ("55", "Final Year Project-II (FYP-II)", 0, 3, 8, bae.id),
    ]

    subjects = {}
    for code, name, theory, lab, sem, d_id in subject_data:
        s = Subject(code=code, full_name=name, theory_credits=theory,
                    lab_credits=lab, semester=sem, department_id=d_id)
        db.add(s)
        db.flush()
        subjects[f"{code}_{d_id}"] = s

    # ── Assignments ─────────────────────────────────────────────
    def sec_ids(yr, dept, *names):
        return [sections[(yr, dept, n)].id for n in names]

    assignment_data = [
        # 22CE — Term 7 (Odd)
        (subjects[f"38_{ce.id}"], teachers["Engr. Naseem Usman Keerio"], None,
         batches[(22, "CE")], sec_ids(22, "CE", "A", "B", "C")),

        (subjects[f"39_{ce.id}"], teachers["Prof. Dr. Riaz Bhanbhro"],
         teachers["Dr. Abdul Qadir Memon"],
         batches[(22, "CE")], sec_ids(22, "CE", "A", "B", "C")),

        (subjects[f"40_{ce.id}"], teachers["Engr. Ubaidullah Memon"],
         teachers["Engr. Fayaz Taj Memon"],
         batches[(22, "CE")], sec_ids(22, "CE", "A", "B", "C")),

        # 25CE — Term 1 (Odd)
        (subjects[f"10_{ce.id}"], teachers["Ms. Agha Kousar"], None,
         batches[(25, "CE")], sec_ids(25, "CE", "A", "B", "C")),

        (subjects[f"14_{ce.id}"], teachers["Mr. Tarique Keerio"], None,
         batches[(25, "CE")], sec_ids(25, "CE", "A", "B", "C")),

        (subjects[f"101_{ce.id}"], teachers["Engr. Aijaz Ali Dahri"],
         teachers["Engr. Natees Altaf Memon"],
         batches[(25, "CE")], sec_ids(25, "CE", "A", "B", "C")),

        (subjects[f"16_{ce.id}"], teachers["Prof. Dr. Daddan Khan Bangwar"],
         teachers["Engr. Ibrahim Shaikh"],
         batches[(25, "CE")], sec_ids(25, "CE", "A", "B", "C")),

        # CET Assign
        (subjects[f"CS-100_{cet.id}"], teachers["CET Expert"], None,
         batches[(25, "CET")], sec_ids(25, "CET", "A")),

        # BAE Assign
        (subjects[f"90_{bae.id}"], teachers["BAE Architect"], None,
         batches[(25, "BAE")], sec_ids(25, "BAE", "A")),
    ]

    for subj, teacher, lab_eng, batch, s_ids in assignment_data:
        a = Assignment(
            subject_id=subj.id,
            teacher_id=teacher.id,
            lab_engineer_id=lab_eng.id if lab_eng else None,
            batch_id=batch.id,
            section_ids=s_ids,
        )
        db.add(a)

    # ── Restrictions & Config (New) ─────────────────────────────
    from models import ScheduleConfig, TeacherRestriction
    
    # Default config for first section (22CE-A)
    sec_a = sections[(22, "CE", "A")]
    ce_config = ScheduleConfig(
        section_id=sec_a.id,
        no_gaps=True,
        lab_morning_days=[4]  # Friday morning lab by default
    )
    db.add(ce_config)
    
    # Sample restriction: Naseem Keerio unavailable on Monday mornings
    t_naseem = teachers["Engr. Naseem Usman Keerio"]
    rest = TeacherRestriction(teacher_id=t_naseem.id, day=0, slot_index=0)
    db.add(rest)

    # ── Users (default logins) ──────────────────────────────────
    admin = User(
        username="admin", password_hash=hash_password("admin123"),
        full_name="Super Admin", role="super_admin",
    )
    admin_ce = User(
        username="admin_ce", password_hash=hash_password("admin123"),
        full_name="CE Program Admin", role="program_admin",
        department_id=ce.id,
        can_manage_restrictions=True,
        can_delete_timetable=True,
    )
    admin_cet = User(
        username="admin_cet", password_hash=hash_password("admin123"),
        full_name="CET Program Admin", role="program_admin",
        department_id=cet.id,
        can_manage_restrictions=True,
        can_delete_timetable=True,
    )
    admin_bae = User(
        username="admin_bae", password_hash=hash_password("admin123"),
        full_name="BAE Program Admin", role="program_admin",
        department_id=bae.id,
        can_manage_restrictions=True,
        can_delete_timetable=True,
    )
    clerk_ce = User(
        username="clerk_ce", password_hash=hash_password("clerk123"),
        full_name="CE Clerk", role="clerk",
        department_id=ce.id,
    )
    # Create teacher user accounts for a few teachers
    teacher_user = User(
        username="riaz", password_hash=hash_password("teacher123"),
        full_name="Prof. Dr. Riaz Bhanbhro", role="teacher",
        department_id=ce.id,
        teacher_id=teachers["Prof. Dr. Riaz Bhanbhro"].id,
    )
    db.add_all([admin, admin_ce, admin_cet, admin_bae, clerk_ce, teacher_user])

    db.commit()
    db.close()
    print("✅ Database seeded successfully!")
    print("   - 3 Departments (CE, CET, BAE)")
    print("   - 12 Batches (4 years × 3 departments)")
    print("   - 12 Classrooms (CR-01 to CR-12)")
    print("   - 6 Labs (Lab-1 to Lab-6)")
    print("   - 20 Sections")
    print("   - 26 Teachers (20 regular + 6 lab engineers)")
    print("   - 100+ Subjects across all departments")
    print("")
    print("   Login: admin / admin123  (Super Admin)")
    print("   Login: admin_ce / admin123  (CE Program Admin)")
    print("   Login: admin_cet / admin123  (CET Program Admin)")
    print("   Login: admin_bae / admin123  (BAE Program Admin)")
    print("   Login: clerk_ce / clerk123  (Clerk)")
    print("   Login: riaz / teacher123  (Teacher)")


if __name__ == "__main__":
    seed()
