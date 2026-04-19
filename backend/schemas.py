"""
Pydantic schemas for request / response validation.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Auth ────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    username: str
    user_id: int
    department_id: Optional[int] = None
    teacher_id: Optional[int] = None
    can_manage_restrictions: bool = False
    can_delete_timetable: bool = False

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    can_manage_restrictions: bool = False
    can_delete_timetable: bool = False
    class Config:
        from_attributes = True


# ── Departments ─────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    code: str
    name: str

class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    class Config:
        from_attributes = True


# ── Batches ─────────────────────────────────────────────────────
class BatchCreate(BaseModel):
    year: int
    department_id: int
    semester: Optional[int] = None
    # Morning lab configuration (NON-DESTRUCTIVE: optional fields)
    morning_lab_mode: Optional[str] = None  # null, "strict", "prefer", "count"
    morning_lab_count: Optional[int] = None  # for "count" mode
    morning_lab_days: List[int] = []  # [0,1,2,3,4] - which days to apply

class BatchOut(BaseModel):
    id: int
    year: int
    department_id: int
    semester: Optional[int] = None
    department_code: Optional[str] = None
    display_name: Optional[str] = None
    # Morning lab configuration
    morning_lab_mode: Optional[str] = None
    morning_lab_count: Optional[int] = None
    morning_lab_days: List[int] = []
    class Config:
        from_attributes = True


# ── Sections ────────────────────────────────────────────────────
class SectionCreate(BaseModel):
    name: Optional[str] = None
    batch_id: int
    department_id: Optional[int] = None
    room_id: Optional[int] = None

class SectionOut(BaseModel):
    id: int
    name: Optional[str] = None
    batch_id: int
    department_id: Optional[int] = None
    room_id: Optional[int] = None
    display_name: Optional[str] = None
    class Config:
        from_attributes = True


# ── Rooms ───────────────────────────────────────────────────────
class RoomCreate(BaseModel):
    name: str
    capacity: Optional[int] = None
    department_id: Optional[int] = None
    is_lab: bool = False

class RoomOut(BaseModel):
    id: int
    name: str
    capacity: Optional[int] = None
    department_id: Optional[int] = None
    is_lab: bool = False
    class Config:
        from_attributes = True


# ── Subjects ────────────────────────────────────────────────────
class SubjectCreate(BaseModel):
    code: str
    full_name: str
    theory_credits: int = 3
    lab_credits: int = 0
    semester: Optional[int] = None
    department_id: int

class SubjectOut(BaseModel):
    id: int
    code: str
    full_name: str
    theory_credits: int
    lab_credits: int
    semester: Optional[int] = None
    department_id: int
    department_name: Optional[str] = None
    credit_display: Optional[str] = None
    class Config:
        from_attributes = True


# ── Teachers ────────────────────────────────────────────────────
class TeacherCreate(BaseModel):
    name: str
    designation: str
    seniority: Optional[int] = None
    max_contact_hours: int = 12
    department_id: int
    is_lab_engineer: bool = False
    allow_consecutive: bool = False
    max_consecutive_classes: int = 2
    restriction_mode: str = "preferred"  # "strict" or "preferred"
    # Account fields
    assign_account: bool = False
    username: Optional[str] = None
    password: Optional[str] = None
    # Cross-dept engagement
    engaged_department_ids: List[int] = []

class TeacherOut(BaseModel):
    id: int
    seniority: Optional[int] = None
    name: str
    designation: str
    max_contact_hours: int
    current_load: float = 0.0
    global_load: float = 0.0
    current_theory_load: float = 0.0
    current_lab_load: float = 0.0
    global_theory_load: float = 0.0
    global_lab_load: float = 0.0
    department_id: int
    department_name: Optional[str] = None
    is_lab_engineer: bool
    allow_consecutive: bool = False
    max_consecutive_classes: int = 2
    restriction_mode: str = "preferred"  # "strict" or "preferred"
    username: Optional[str] = None
    user_id: Optional[int] = None
    engaged_department_ids: List[int] = []
    class Config:
        from_attributes = True


# ── Assignment Sessions ───────────────────────────────────────
class AssignmentSessionCreate(BaseModel):
    name: str
    # department_id removed - sessions are now university-wide

class AssignmentSessionOut(BaseModel):
    id: int
    name: str
    # department_id removed - sessions are now university-wide
    is_archived: bool = False
    session_type: str = "regular"  # "regular" or "makeup"
    department_code: Optional[str] = None  # Added for display purposes (e.g., "CE")
    class Config:
        from_attributes = True

class AssignmentSessionUpdate(BaseModel):
    name: Optional[str] = None
    is_archived: Optional[bool] = None

class BulkSelector(BaseModel):
    ids: List[int]


# ── Assignments ─────────────────────────────────────────────────
class AssignmentCreate(BaseModel):
    session_id: Optional[int] = None
    subject_id: int
    teacher_id: Optional[int] = None
    lab_engineer_id: Optional[int] = None
    lab_room_id: Optional[int] = None
    batch_id: int
    section_ids: List[int]
    combination_id: Optional[str] = None
    consecutive_lectures: int = 0  # 0=none, 2=two consecutive, 3=three consecutive

class AssignmentUpdate(BaseModel):
    teacher_id: Optional[int] = None
    lab_engineer_id: Optional[int] = None
    lab_room_id: Optional[int] = None
    section_ids: Optional[List[int]] = None
    combination_id: Optional[str] = None
    consecutive_lectures: Optional[int] = None

class AssignmentOut(BaseModel):
    id: int
    session_id: Optional[int] = None
    subject_id: int
    teacher_id: Optional[int] = None
    lab_engineer_id: Optional[int] = None
    lab_room_id: Optional[int] = None
    batch_id: int
    section_ids: List[int]
    section_names: Optional[List[str]] = None
    combination_id: Optional[str] = None
    subject_code: Optional[str] = None
    session_name: Optional[str] = None
    department_name: Optional[str] = None
    subject_full_name: Optional[str] = None
    batch_name: Optional[str] = None
    teacher_name: Optional[str] = None
    lab_engineer_name: Optional[str] = None
    theory_credits: Optional[float] = 0.0
    lab_credits: Optional[float] = 0.0
    consecutive_lectures: int = 0
    class Config:
        from_attributes = True

class ExtractedAssignmentOut(BaseModel):
    raw_teacher: str
    raw_subject: str
    theory_credits: int
    lab_credits: int
    raw_lab_engineer: Optional[str] = None
    raw_batch: Optional[str] = None
    raw_sections: Optional[str] = None
    
    # Matches
    matched_teacher_id: Optional[int] = None
    matched_teacher_name: Optional[str] = None
    matched_subject_id: Optional[int] = None
    matched_subject_name: Optional[str] = None
    matched_lab_engineer_id: Optional[int] = None
    matched_lab_engineer_name: Optional[str] = None
    matched_batch_id: Optional[int] = None
    matched_batch_name: Optional[str] = None
    confidence: float = 0.0


class BulkImportRequest(BaseModel):
    session_id: int
    batch_id: int
    assignments: List[ExtractedAssignmentOut]

class BulkBatchTerm(BaseModel):
    batch_id: int
    semester: int

class BulkAssignmentGenerateRequest(BaseModel):
    session_id: int
    batch_terms: List[BulkBatchTerm]
    split_sections: bool = False


class BulkDeleteRequest(BaseModel):
    ids: List[int]


# ── Timetable ──────────────────────────────────────────────────
class TimetableSlotOut(BaseModel):
    id: int
    day: int
    slot_index: int
    section_id: int
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    room_id: Optional[int] = None
    is_lab: bool = False
    lab_engineer_id: Optional[int] = None
    is_break: bool = False
    label: Optional[str] = None
    # Denormalized display fields
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    credit_hours: Optional[int] = None
    theory_credits: Optional[int] = None
    lab_credits: Optional[int] = None
    teacher_name: Optional[str] = None
    room_name: Optional[str] = None
    section_name: Optional[str] = None
    lab_engineer_name: Optional[str] = None
    class Config:
        from_attributes = True

class TimetableOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    status: str
    semester_info: Optional[str] = None
    created_by_id: Optional[int] = None
    class_duration: int = 60
    start_time: Optional[str] = "08:30"
    break_start_time: Optional[str] = None
    break_end_time: Optional[str] = None
    max_slots_per_day: Optional[int] = None
    max_slots_friday: int = 5
    break_slot: int = 2
    friday_has_break: bool = False
    slots: List[TimetableSlotOut] = []
    department_id: Optional[int] = None
    session_id: Optional[int] = None
    class Config:
        from_attributes = True

class TimetableUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    max_slots_per_day: Optional[int] = None
    max_slots_friday: Optional[int] = None
    break_slot: Optional[int] = None
    start_time: Optional[str] = None
    break_start_time: Optional[str] = None
    break_end_time: Optional[str] = None
    class_duration: Optional[int] = None
    friday_has_break: Optional[bool] = None

class GenerateRequest(BaseModel):
    name: str = "Auto Generated"
    semester_info: Optional[str] = None
    session_id: Optional[int] = None
    batch_ids: Optional[List[int]] = None # Bulk if None/Empty
    sequential_mode: bool = False  # If True, process batches sequentially (one by one)
    extra_classes_per_subject: int = 0
    class_duration: int = 60
    start_time: Optional[str] = "08:30"  # Start time for first lecture
    break_slot: int = 2
    break_start_time: Optional[str] = "10:30"
    break_end_time: Optional[str] = "11:00"
    max_slots_per_day: Optional[int] = 8
    max_slots_friday: int = 4  # Default to 4
    friday_has_break: bool = False
    allow_friday_labs: bool = False  # No labs on Friday (only theory classes)
    prefer_early_dismissal: bool = False
    semester_type: Optional[str] = "Fall" # Fall, Spring, Summer
    morning_lab_section_ids: List[int] = []  # Section IDs that prefer morning labs; empty = no morning labs
    lab_is_last: bool = True  # Enforce No Theory After Lab on the Same Day
    uniform_lab_start_batch_ids: List[int] = []  # Batch IDs that require uniform afternoon lab starts (Early Finish Classes)
    timetable_id: Optional[int] = None  # Existing timetable to append/update


# ── Teacher Restrictions ────────────────────────────────────────
class TeacherRestrictionCreate(BaseModel):
    teacher_id: int
    day: int
    slot_index: int

class TeacherRestrictionOut(BaseModel):
    id: int
    teacher_id: int
    day: int
    slot_index: int
    class Config:
        from_attributes = True


# ── Schedule Config ─────────────────────────────────────────────
class ScheduleConfigCreate(BaseModel):
    section_id: int
    lab_morning_days: List[int] = []
    no_gaps: bool = True

class ScheduleConfigOut(BaseModel):
    id: int
    section_id: int
    lab_morning_days: List[int]
    no_gaps: bool
    class Config:
        from_attributes = True


# ── Restrictions Summary ────────────────────────────────────────
class RestrictedTeacherSummary(BaseModel):
    id: int
    name: str
    count: int

class RestrictedSectionSummary(BaseModel):
    id: int
    name: str
    reason: str # e.g. "Gaps Allowed", "Morning labs: Mon, Tue"

class RestrictionsSummaryOut(BaseModel):
    teachers: List[RestrictedTeacherSummary]
    sections: List[RestrictedSectionSummary]


# ── User Management (extended) ──────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str  # super_admin, program_admin, teacher, lab_engineer, clerk
    department_id: Optional[int] = None
    can_manage_restrictions: bool = False
    can_delete_timetable: bool = False

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    can_manage_restrictions: Optional[bool] = None
    can_delete_timetable: Optional[bool] = None

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

# ── Dashboard Summary ───────────────────────────────────────────
class DeptWorkload(BaseModel):
    dept_code: str
    total_hours: float

class TeacherWorkloadSummary(BaseModel):
    id: int
    name: str
    current_hours: float
    max_hours: int
    utilization: float  # percentage
    assignments_count: int

class SubjectDistribution(BaseModel):
    semester: Optional[int]
    count: int

class DashboardSummaryOut(BaseModel):
    stats: dict  # {teachers: 0, subjects: 0, rooms: 0, timetables: 0}
    recent_timetables: List[TimetableOut]
    workload_distribution: List[DeptWorkload]
    teacher_workload: Optional[List[TeacherWorkloadSummary]] = []
    subject_distribution: Optional[List[SubjectDistribution]] = []
    assignment_coverage: Optional[dict] = None  # {assigned: 0, total: 0, percentage: 0}
    teacher_utilization: Optional[dict] = None  # {underutilized: 0, optimal: 0, overloaded: 0}
