"""
SQLAlchemy ORM models for the Timetable Portal.
"""
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Boolean, JSON, DateTime, Text,
    UniqueConstraint, BigInteger, func, Date
)
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


# ── Users & Auth ────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False)  # super_admin, program_admin, teacher, lab_engineer, clerk
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    can_manage_restrictions = Column(Boolean, default=False)
    can_delete_timetable = Column(Boolean, default=False)

    department = relationship("Department", back_populates="users")
    timetables = relationship("Timetable", back_populates="creator")
    teacher = relationship("Teacher", back_populates="user")


# ── Departments ─────────────────────────────────────────────────
class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)  # CE, CET, BAE
    name = Column(String(200), nullable=False)

    batches = relationship("Batch", back_populates="department", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="department", cascade="all, delete-orphan")
    teachers = relationship("Teacher", back_populates="department", cascade="all, delete-orphan")
    users = relationship("User", back_populates="department")
    # Removed sessions relationship - sessions are now university-wide
    timetables = relationship("Timetable", back_populates="department", cascade="all, delete-orphan")


# ── Batches ─────────────────────────────────────────────────────
class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)  # 22, 23, 24, 25
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester = Column(Integer, nullable=True)  # current semester number
    
    # Morning lab configuration (NON-DESTRUCTIVE: added fields, existing data unaffected)
    morning_lab_mode = Column(String, nullable=True)  # null, "strict", "prefer", "count"
    morning_lab_count = Column(Integer, nullable=True)  # for "count" mode: how many labs in morning
    morning_lab_days = Column(JSON, nullable=False, default=list)  # [0,1,2,3,4] - which days to apply

    department = relationship("Department", back_populates="batches")
    sections = relationship("Section", back_populates="batch", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("year", "department_id"),)

    @property
    def display_name(self):
        return f"{self.year}{self.department.code}"


# ── Sections ────────────────────────────────────────────────────
class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=True)  # A, B, C or None for single-section depts
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True) # For direct linking
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)  # default classroom

    batch = relationship("Batch", back_populates="sections")
    department = relationship("Department")
    room = relationship("Room", back_populates="sections")
    timetable_slots = relationship("TimetableSlot", back_populates="section")

    __table_args__ = (UniqueConstraint("name", "batch_id"),)

    @property
    def display_name(self):
        batch = self.batch
        if not self.name or self.name == "X":
            return f"{batch.year}{batch.department.code}"
        return f"{batch.year}{batch.department.code}-{self.name}"


# ── Rooms ───────────────────────────────────────────────────────
class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # "Classroom #1"
    capacity = Column(Integer, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True) # Null = Global
    is_lab = Column(Boolean, default=False)

    department = relationship("Department", backref="rooms")
    sections = relationship("Section", back_populates="room")


# ── Subjects ────────────────────────────────────────────────────
class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False)  # "GE", "I&DE", "SDD"
    full_name = Column(String(300), nullable=False)
    theory_credits = Column(Integer, nullable=False, default=3)  # 3, 2, 0
    lab_credits = Column(Integer, nullable=False, default=0)     # 1, 0
    semester = Column(Integer, nullable=True)                    # 1, 3, 5, 7
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)

    department = relationship("Department", back_populates="subjects")
    assignments = relationship("Assignment", back_populates="subject", cascade="all, delete-orphan")

    @property
    def credit_display(self):
        return f"{self.theory_credits}+{self.lab_credits}"


# ── Teachers ────────────────────────────────────────────────────
class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    seniority = Column(Integer, nullable=True)  # Serial number / seniority rank
    name = Column(String(200), nullable=False)
    designation = Column(String(100), nullable=False)
    max_contact_hours = Column(Integer, nullable=False, default=12)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    is_lab_engineer = Column(Boolean, default=False)
    allow_consecutive = Column(Boolean, default=False)  # Allow consecutive classes
    max_consecutive_classes = Column(Integer, default=2)  # Max consecutive slots (2, 3, 4, etc.)
    restriction_mode = Column(String(20), default="preferred")  # "strict" or "preferred" - per-teacher restriction enforcement

    department = relationship("Department", back_populates="teachers")
    engagements = relationship("TeacherDepartmentEngagement", back_populates="teacher", cascade="all, delete-orphan")
    user = relationship("User", back_populates="teacher", uselist=False)
    assignments = relationship("Assignment", back_populates="teacher",
                               foreign_keys="Assignment.teacher_id", cascade="all, delete-orphan")
    lab_assignments = relationship("Assignment", back_populates="lab_engineer",
                                   foreign_keys="Assignment.lab_engineer_id",
                                   cascade="all, delete-orphan")
    restrictions = relationship("TeacherRestriction", back_populates="teacher", cascade="all, delete-orphan")


class TeacherDepartmentEngagement(Base):
    """Association table for teachers engaged by other departments."""
    __tablename__ = "teacher_department_engagements"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)

    teacher = relationship("Teacher", back_populates="engagements")
    department = relationship("Department")

    __table_args__ = (UniqueConstraint("teacher_id", "department_id"),)


# ── Assignment Sessions ───────────────────────────────────────
class AssignmentSession(Base):
    __tablename__ = "assignment_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. "Fall 2025", "Even 2026-1", "Makeup-1" - University-wide
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    session_type = Column(String(20), default="regular")  # "regular" or "makeup"
    suffix_number = Column(Integer, default=0)  # For duplicate names: 0 (no suffix), 1, 2, 3...

    # Removed department_id - sessions are now university-wide
    # Department filtering is done via assignments
    # Removed unique=True from name to allow duplicates with suffixes
    
    assignments = relationship("Assignment", back_populates="session", cascade="all, delete-orphan")
    timetables = relationship("Timetable", back_populates="session")
    makeup_classes = relationship("MakeupClass", back_populates="session", cascade="all, delete-orphan")


# ── Assignments (Subject ↔ Teacher ↔ Sections) ─────────────────
class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assignment_sessions.id"), nullable=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    lab_engineer_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    lab_room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)  # Lab room for lab sessions
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    section_ids = Column(JSON, nullable=False, default=list)  # list of section ids
    combination_id = Column(String(100), nullable=True, index=True) # group ID for shared slots
    consecutive_lectures = Column(Integer, nullable=False, default=0)  # 0=none, 2=two consecutive, 3=three consecutive

    session = relationship("AssignmentSession", back_populates="assignments")
    subject = relationship("Subject", back_populates="assignments")
    teacher = relationship("Teacher", back_populates="assignments",
                           foreign_keys=[teacher_id])
    lab_engineer = relationship("Teacher", back_populates="lab_assignments",
                                foreign_keys=[lab_engineer_id])
    lab_room = relationship("Room", foreign_keys=[lab_room_id])
    batch = relationship("Batch", back_populates="assignments")


# ── Timetable (generated output) ───────────────────────────────
class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="generated")  # generated, active, archived
    semester_info = Column(String(100), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("assignment_sessions.id"), nullable=True, index=True)

    department = relationship("Department", back_populates="timetables")
    session = relationship("AssignmentSession", back_populates="timetables")
    creator = relationship("User", back_populates="timetables")
    class_duration = Column(Integer, default=60)      # Minutes
    start_time = Column(String(50), default="08:30")  # e.g. "08:00", "08:30", "09:00"
    break_start_time = Column(String(50), nullable=True) # e.g. "10:30"
    break_end_time = Column(String(50), nullable=True)   # e.g. "11:00"
    max_slots_per_day = Column(Integer, nullable=True)
    max_slots_friday = Column(Integer, default=5)
    semester_type = Column(String(50), nullable=True, default="Fall") # Fall, Spring, Summer
    break_slot = Column(Integer, default=2)
    friday_has_break = Column(Boolean, default=False)

    slots = relationship("TimetableSlot", back_populates="timetable",
                          cascade="all, delete-orphan")


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"), nullable=False)
    day = Column(Integer, nullable=False)        # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
    slot_index = Column(Integer, nullable=False)  # 0-based slot within the day
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    is_lab = Column(Boolean, default=False)
    lab_engineer_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    is_break = Column(Boolean, default=False)
    label = Column(String(100), nullable=True)  # e.g. "FYP-II", "Break"

    timetable = relationship("Timetable", back_populates="slots")
    section = relationship("Section", back_populates="timetable_slots")
    subject = relationship("Subject")
    teacher = relationship("Teacher", foreign_keys=[teacher_id])
    lab_engineer = relationship("Teacher", foreign_keys=[lab_engineer_id])
    room = relationship("Room")


class TeacherRestriction(Base):
    __tablename__ = "teacher_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    day = Column(Integer, nullable=False)        # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
    slot_index = Column(Integer, nullable=False)

    teacher = relationship("Teacher")

    __table_args__ = (UniqueConstraint("teacher_id", "day", "slot_index"),)


class ScheduleConfig(Base):
    __tablename__ = "schedule_configs"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    # JSON containing which days have labs in morning, e.g. [0, 2] for Mon, Wed
    lab_morning_days = Column(JSON, nullable=False, default=list)
    no_gaps = Column(Boolean, default=True)

    section = relationship("Section")

    __table_args__ = (UniqueConstraint("section_id"),)


class GlobalConfig(Base):
    __tablename__ = "global_configs"

    id = Column(Integer, primary_key=True, index=True)
    # Time Grid
    max_slots_per_day = Column(Integer, default=8)
    max_slots_friday = Column(Integer, default=5)
    break_slot = Column(Integer, default=2)
    start_time = Column(String(50), default="08:30")  # e.g. "08:00", "08:30", "09:00"
    break_start_time = Column(String(50), default="10:30")
    break_end_time = Column(String(50), default="11:00")
    friday_has_break = Column(Boolean, default=False)
    
    # Penalties
    gap_penalty = Column(BigInteger, default=5000000)
    workload_penalty = Column(BigInteger, default=2000000)
    early_slot_penalty = Column(Integer, default=10)
    lab_priority_multiplier = Column(Integer, default=50)
    compact_morning = Column(Boolean, default=False)
    
    # Solver Config
    solver_timeout = Column(Integer, default=60) # Seconds
    strict_teacher_restrictions = Column(Boolean, default=False)
    
    # Rules
    # List of locks: [{"dept": "CE", "batch": 22, "day": 4, "label": "FYP-II", "subject_codes": ["FYP-II"]}]
    fyp_rules = Column(JSON, default=list) 
    # List of lab preferences: [{"dept": "CE", "batch": 22, "morning_days": [0, 1]}]
    lab_rules = Column(JSON, default=list)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Makeup Classes (Separate System) ──────────────────────────────
class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(50), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch")
    section = relationship("Section")
    department = relationship("Department")
    makeup_enrollments = relationship("MakeupEnrollment", back_populates="student", cascade="all, delete-orphan")


class MakeupClass(Base):
    __tablename__ = "makeup_classes"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assignment_sessions.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    
    # Makeup specific fields
    reason = Column(String(500), nullable=True)  # Why makeup is needed
    original_date = Column(Date, nullable=True)  # Date of missed class
    is_lab = Column(Boolean, default=False)
    lab_engineer_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    session = relationship("AssignmentSession", back_populates="makeup_classes")
    subject = relationship("Subject")
    teacher = relationship("Teacher", foreign_keys=[teacher_id])
    lab_engineer = relationship("Teacher", foreign_keys=[lab_engineer_id])
    room = relationship("Room")
    department = relationship("Department")
    creator = relationship("User")
    enrollments = relationship("MakeupEnrollment", back_populates="makeup_class", cascade="all, delete-orphan")


class MakeupEnrollment(Base):
    __tablename__ = "makeup_enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    makeup_class_id = Column(Integer, ForeignKey("makeup_classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    
    makeup_class = relationship("MakeupClass", back_populates="enrollments")
    student = relationship("Student", back_populates="makeup_enrollments")


class MakeupTimetable(Base):
    __tablename__ = "makeup_timetables"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    session_id = Column(Integer, ForeignKey("assignment_sessions.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="draft")  # draft, active, archived
    
    # Timetable settings (can be different from regular timetables)
    class_duration = Column(Integer, default=60)
    start_time = Column(String(50), default="08:30")
    break_start_time = Column(String(50), nullable=True)
    break_end_time = Column(String(50), nullable=True)
    max_slots_per_day = Column(Integer, default=8)
    break_slot = Column(Integer, default=2)
    
    session = relationship("AssignmentSession")
    department = relationship("Department")
    creator = relationship("User")
    slots = relationship("MakeupTimetableSlot", back_populates="timetable", cascade="all, delete-orphan")


class MakeupTimetableSlot(Base):
    __tablename__ = "makeup_timetable_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("makeup_timetables.id"), nullable=False)
    makeup_class_id = Column(Integer, ForeignKey("makeup_classes.id"), nullable=False)
    day = Column(Integer, nullable=False)  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
    slot_index = Column(Integer, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    
    timetable = relationship("MakeupTimetable", back_populates="slots")
    makeup_class = relationship("MakeupClass")
    room = relationship("Room")
