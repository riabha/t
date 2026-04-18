"""
OR-Tools CP-SAT Constraint Solver for Timetable Generation.

Time Grid:
  Mon-Thu: 8 slots (0-7), slot 2 = break (10:30-11:00)
    Slot 0: 08:30-09:30
    Slot 1: 09:30-10:30
    Slot 2: 10:30-11:00  (BREAK — not schedulable)
    Slot 3: 11:00-12:00
    Slot 4: 12:00-13:00
    Slot 5: 13:00-14:00
    Slot 6: 14:00-15:00
    Slot 7: 15:00-16:00

  Friday: 5 slots (0-4), NO break
    Slot 0: 08:30-09:30
    Slot 1: 09:30-10:30
    Slot 2: 10:30-11:30
    Slot 3: 11:30-12:30
    Slot 4: 12:30-13:30

Constraints:
  - Theory (N credits): N × 1-hour slots on N DIFFERENT days
  - Lab (1 credit = 3 contact hours): 1 block of 3 contiguous slots
  - Zero-clash: teacher, room, section
  - Lab engineer co-scheduled with lab block
  - Max contact hours per teacher/designation
  - NO LABS ON FRIDAY (generalized rule for all batches)
  - Break slot (slot 2, Mon-Thu) is never scheduled

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES - DO NOT MODIFY WITHOUT UNDERSTANDING
═══════════════════════════════════════════════════════════════════════════════

1. TEACHER BLOCKING RULE:
   - Teachers are ONLY blocked during slots they are ASSIGNED to
   - Theory teacher: blocked ONLY during theory slots (line ~477)
   - Lab engineer: blocked ONLY during lab slots (line ~585)
   - Theory teacher is NEVER blocked during lab time
   - Lab engineer is NEVER blocked during theory time
   
   Example: 3+1 credit subject (3 theory + 1 lab)
   - Theory teacher: teaches 3 theory hours, FREE during lab
   - Lab engineer: teaches 1 lab (3 contact hours), FREE during theory
   
   THIS RULE IS CORRECT - DO NOT CHANGE IT

2. NO-GAPS CONSTRAINT BEHAVIOR:
   - Normal mode: no-gaps is HARD constraint (no gaps allowed)
   - Strict morning lab mode: no-gaps becomes SOFT constraint (gaps allowed when needed)
   
   WHY: With strict mode (theory only slots 4-7 on Mon-Thu) + shared teachers
   across batches, no-gaps HARD constraint is too restrictive and causes INFEASIBLE.
   Making it SOFT allows solver to create gaps when necessary for shared teachers
   while still preferring no gaps via penalty.
   
   See lines ~856-888 for implementation

3. INFEASIBLE ERROR TROUBLESHOOTING:
   If you get INFEASIBLE with sufficient capacity:
   
   a) Check for shared teachers across batches
      - Shared teachers create cross-batch dependencies
      - Solver must coordinate schedules across all batches simultaneously
      
   b) Check if strict mode is active
      - Strict mode limits theory to slots 4-7 on configured days
      - This reduces available slots significantly
      
   c) Check no-gaps constraint
      - If no-gaps is HARD + strict mode + shared teachers = likely INFEASIBLE
      - Solution: no-gaps becomes SOFT in strict mode (already implemented)
      
   d) DO NOT assume teacher blocking is the issue
      - Teacher blocking rule is correct (see rule #1 above)
      - INFEASIBLE is usually caused by constraint conflicts, not blocking

═══════════════════════════════════════════════════════════════════════════════
"""

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session
from typing import List
from models import (
    Assignment, Section, Subject, Teacher, Batch, Department,
    Room, Timetable, TimetableSlot, TeacherRestriction, ScheduleConfig
)
from collections import defaultdict


# ── Constants ───────────────────────────────────────────────────
DAYS = list(range(5))  # 0=Mon … 4=Fri
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# Schedulable slot indices per day
# Mon-Thu: ALL 8 slots (0-7) are now schedulable.
# The break is enforced dynamically per section per day via constraints.
# Slot 2 = default break (10:30), Slot 3 = morning-lab-day break (11:00)
SLOTS_MON_THU = [0, 1, 2, 3, 4, 5, 6, 7]  # all slots; break enforced via constraints
SLOTS_FRI = [0, 1, 2, 3, 4]               # no break, 5 slots

# Lab-eligible starting positions (need 3 contiguous slots)
# Mon-Thu valid lab starts that do NOT span across BOTH {slot2, slot3}:
#   slot 0 → block [0,1,2]  (Morning lab; forces break to slot 3)
#   slot 3 → block [3,4,5]  (Normal afternoon lab; after slot-2 break)
#   slot 4 → block [4,5,6]  (Afternoon lab; safely after both breaks)
#   slot 5 → block [5,6,7]  (Afternoon lab; safely after both breaks)
# The break constraint ensures: if a morning lab runs on a day, slot 3 is
# blocked for that section on that day via OnlyEnforceIf, so a slot-3 lab
# and a morning lab can never co-exist on the same section/day.
LAB_STARTS_MON_THU = [0, 3, 4, 5]  # morning + all afternoon positions
LAB_STARTS_FRI = [0, 1, 2]      # yields blocks [0,1,2], [1,2,3], [2,3,4]

# Morning lab start (same as LAB_STARTS_MON_THU[0])
LAB_STARTS_MORNING = [0]  # Morning labs start at 0 (0-1-2)

BREAK_SLOT = 2  # default break slot on Mon-Thu (slot 3 is used when morning lab is scheduled)


def get_schedulable_slots(day: int, break_slot: int = 2):
    """Return list of slot indices that can hold classes on a given day."""
    if day == 4:  # Friday
        return SLOTS_FRI
    # Mon-Thu: all slots except the break slot
    return [i for i in range(8) if i != break_slot]


def get_lab_starts(day: int, break_slot: int = 2, is_morning_lab: bool = False):
    """Return valid starting slot indices for a 3-hour lab block."""
    if day == 4:
        return LAB_STARTS_FRI
    
    # Mon-Thu: Lab needs 3 contiguous slots that don't include the break slot
    valid_starts = []
    # Check all possible start positions (0 to 5 for 8 slots)
    for s in range(8 - 2):
        block = [s, s+1, s+2]
        if break_slot not in block:
            valid_starts.append(s)
            
    # Note: the is_morning_lab preference is handled by variable costs and
    # the solver's objective function to prioritize early slots.
    return valid_starts


def generate_timetable(db: Session, name: str = "Auto Generated",
                       semester_info: str = None, user_id: int = None,
                       target_dept_id: int = None,
                       extra_classes_per_subject: int = 0,
                       class_duration: int = 60,
                       start_time: str = None,
                       break_slot: int = None,
                       break_start_time: str = None,
                       break_end_time: str = None,
                       max_slots_per_day: int = None,
                       max_slots_friday: int = None,
                       morning_lab_section_ids: list = None,
                       friday_has_break: bool = False,
                       allow_friday_labs: bool = False,
                       prefer_early_dismissal: bool = False,
                       lab_is_last: bool = True,
                       session_id: int = None,
                       batch_ids: List[int] = None,
                       uniform_lab_start_batch_ids: List[int] = None,
                       timetable_id: int = None) -> Timetable:
    """
    Main entry point: reads all assignments from DB, builds a CP-SAT model,
    solves it, and writes the result as TimetableSlot rows.
    """
    db.expire_on_commit = False  # Prevent DetachedInstanceError by keeping objects in session
    model = cp_model.CpModel()

    # Load Global Settings
    from routers.settings import get_or_create_config
    conf = get_or_create_config(db)
    
    # Use defaults from config if not provided in arguments
    break_slot = break_slot if break_slot is not None else conf.break_slot
    break_start_time = break_start_time if break_start_time is not None else conf.break_start_time
    break_end_time = break_end_time if break_end_time is not None else conf.break_end_time
    max_slots_per_day = max_slots_per_day if max_slots_per_day is not None else conf.max_slots_per_day
    max_slots_friday = max_slots_friday if max_slots_friday is not None else conf.max_slots_friday
    friday_has_break = friday_has_break if friday_has_break is not None else conf.friday_has_break
    
    gap_penalty = conf.gap_penalty
    workload_penalty = conf.workload_penalty
    early_slot_penalty = conf.early_slot_penalty
    lab_priority_multiplier = conf.lab_priority_multiplier
    fyp_rules = conf.fyp_rules or []
    lab_rules = conf.lab_rules or []
    solver_timeout = conf.solver_timeout or 60
    compact_morning = conf.compact_morning

    # Schedulable slot indices per day
    # Mon-Thu: 0-7 excluding break_slot (original behavior).
    # Morning labs (start=0) occupy slot 2 via lab vars, never via theory vars.
    # A separate lightweight constraint handles the break shift to slot 3 on morning-lab days.
    schedulable_slots = {}
    for d in range(4):
        schedulable_slots[d] = [i for i in range(max_slots_per_day or 8) if i != break_slot]
    
    if friday_has_break:
        schedulable_slots[4] = [i for i in range(max_slots_friday) if i != break_slot]
    else:
        schedulable_slots[4] = list(range(max_slots_friday))

    # Lab possible starts for Mon-Thu
    # Now controlled by batch-level lab_placement_mode configuration
    # Default: afternoon only [3, 4, 5]
    # Will be overridden per batch based on their lab_placement_mode
    lab_starts = {}
    for d in range(4):
        lab_starts[d] = [s for s in LAB_STARTS_MON_THU if s != 0]  # [3, 4, 5] - afternoon only (default)
    
    # Friday lab starts (unchanged — Friday has no break conflict)
    valid_fri = []
    for s in range(max_slots_friday - 2):
        if not friday_has_break or (break_slot not in [s, s+1, s+2]):
            valid_fri.append(s)
    lab_starts[4] = valid_fri

    # ── Load data ───────────────────────────────────────────────
    query = db.query(Assignment)
    
    # Session Filtering
    if session_id:
        query = query.filter(Assignment.session_id == session_id)
    
    # Department Filtering - ALWAYS filter by department if provided
    # This is critical because sessions are university-wide
    if target_dept_id:
        query = query.join(Subject).filter(Subject.department_id == target_dept_id)
    
    # Batch Filtering (Batch-wise generation)
    # If batch_ids is provided, we only want to schedule these batches.
    # However, we still need to know ALL assignments in the session to handle teacher load/clashes?
    # Actually, the user says "batch wise the clash rule still exists".
    # This implies we only generate for requested batches, but respect teacher/room usage by others.
    
    session_assignments = query.all()
    
    if batch_ids:
        # Strictly schedule ONLY these batches (batch_ids actually contains IDs from frontend like [1, 2, 3])
        target_assignments = [
            a for a in session_assignments 
            if a.batch and a.batch.id in batch_ids
        ]
    else:
        # Bulk generation: schedule everything in the session
        target_assignments = session_assignments

    all_sections = db.query(Section).all()
    all_teachers = db.query(Teacher).all()
    all_rooms = db.query(Room).all()
    all_subjects = db.query(Subject).all()

    section_map = {s.id: s for s in all_sections}
    teacher_map = {t.id: t for t in all_teachers}
    room_map = {r.id: r for r in all_rooms}
    subject_map = {s.id: s for s in all_subjects}

    # Fetch Restrictions & Configs
    teacher_restrictions = db.query(TeacherRestriction).all()
    # Map: teacher_id -> set((day, slot))
    restricted_slots = defaultdict(set)
    for tr in teacher_restrictions:
        restricted_slots[tr.teacher_id].add((tr.day, tr.slot_index))
    
    # Load teacher restriction modes: teacher_id -> "strict" or "preferred"
    teacher_restriction_modes = {}
    for teacher in all_teachers:
        teacher_restriction_modes[teacher.id] = teacher.restriction_mode or "preferred"

    # Cross-Dept Clashes: Load slots from other GENERATED or ACTIVE timetables
    # IMPORTANT: Ignore slots that belong to the SAME department we are currently generating
    # to avoid conflicting with older versions of ourselves.
    query = db.query(TimetableSlot).join(Timetable).filter(
        Timetable.status.in_(["generated", "active"])
    )
    
    if target_dept_id:
        # Exclude slots from sections belonging to the target department
        query = query.join(Section).join(Batch).filter(Batch.department_id != target_dept_id)
    
    existing_slots = query.all()
    for s in existing_slots:
        if s.teacher_id:
            restricted_slots[s.teacher_id].add((s.day, s.slot_index))
        if s.lab_engineer_id:
            restricted_slots[s.lab_engineer_id].add((s.day, s.slot_index))

    # Section ID -> ScheduleConfig
    section_configs = {c.section_id: c for c in db.query(ScheduleConfig).all()}
    
    # Load batch morning lab configurations
    # Map: batch_id -> {"mode": "strict"/"prefer"/"count", "days": [0,1,2,3], "count": 3}
    all_batches = db.query(Batch).all()
    batch_morning_lab_config = {}
    for batch in all_batches:
        if batch.morning_lab_mode:
            batch_morning_lab_config[batch.id] = {
                "mode": batch.morning_lab_mode,
                "days": batch.morning_lab_days or [],
                "count": batch.morning_lab_count or 0
            }

    # Build expanded assignment list: one entry per (assignment, section)
    # Each "task" = one section needing scheduling for one subject
    tasks = []
    
    # We only process assignments for the specific session/batches requested
    for asgn in target_assignments:
        subj = subject_map.get(asgn.subject_id)
        if not subj: continue
        
        # Determine target sections and their configurations
        asgn_sections = [section_map.get(sid) for sid in (asgn.section_ids or []) if section_map.get(sid)]
        
        if not asgn_sections:
            # Handle batches with no defined sections or assignments with no sections
            # Find any section for this batch, preferably one with name=None
            batch_sections = [s for s in all_sections if s.batch_id == asgn.batch_id]
            if batch_sections:
                default_sec = next((s for s in batch_sections if not s.name), batch_sections[0])
                asgn_sections = [default_sec]
            else:
                # Create a hidden default section if none exists
                new_sec = Section(name=None, batch_id=asgn.batch_id, department_id=asgn.batch.department_id)
                db.add(new_sec)
                db.flush() # Flush instead of commit to avoid expiring objects in the session
                section_map[new_sec.id] = new_sec
                all_sections.append(new_sec) # Update local list too
                asgn_sections = [new_sec]
            
        default_room_id = asgn_sections[0].room_id
        batch_year = asgn_sections[0].batch.year if asgn_sections[0].batch else 0
        dept_code = asgn_sections[0].batch.department.code if asgn_sections[0].batch and asgn_sections[0].batch.department else ""
        asgn_section_ids = [s.id for s in asgn_sections]
        asgn_configs = [section_configs.get(sid) for sid in asgn_section_ids if section_configs.get(sid)]
        
        tasks.append({
            "assignment": asgn,
            "subject": subj,
            "teacher_id": asgn.teacher_id,
            "lab_engineer_id": asgn.lab_engineer_id,
            "lab_room_id": asgn.lab_room_id,  # Lab room for lab sessions
            "section_ids": asgn_section_ids,
            "room_id": default_room_id,
            "batch_year": batch_year,
            "dept_code": dept_code,
            "theory_credits": subj.theory_credits,  # Base credit hours only — extra handled in constraints
            "lab_credits": subj.lab_credits,
            "combination_id": asgn.combination_id,
            "no_gaps": any(c.no_gaps for c in asgn_configs) if asgn_configs else True,
            "lab_morning_days": list(set([d for c in asgn_configs for d in (c.lab_morning_days or [])]))
        })

    if not tasks:
        # Nothing to schedule — create empty timetable
        tt = Timetable(
            name=name, status="empty", semester_info=semester_info,
            department_id=target_dept_id,
            session_id=session_id,
            class_duration=class_duration,
            break_start_time=break_start_time,
            break_end_time=break_end_time,
            max_slots_per_day=max_slots_per_day,
            break_slot=break_slot
        )
        db.add(tt)
        db.commit()
        db.refresh(tt)
        return tt

    # ── Identify Rule-Restricted sections (FYP, Seminar, etc.) ───
    # Map: section_id -> list of dict with lock info
    section_locks = defaultdict(list)
    tasks_to_remove = []

    for rule in fyp_rules:
        target_dept = rule.get("dept")
        target_batch = rule.get("batch")
        lock_day = rule.get("day")
        lock_label = rule.get("label", "Restricted")
        subject_codes = rule.get("subject_codes", [])  # e.g. ["FYP-II"], ["FYP-I"]
        start_slot = rule.get("start_slot", 0)  # Default to slot 0
        consecutive_slots = rule.get("consecutive_slots", 5)  # Default to 5 slots
        
        for t in tasks:
            if (not target_dept or t["dept_code"] == target_dept) and \
               (not target_batch or t["batch_year"] == target_batch):
                
                is_exact_match = False
                if subject_codes:
                    if t["subject"].code not in subject_codes:
                        continue
                    is_exact_match = True
                elif lock_label == t["subject"].code:
                    is_exact_match = True
                
                if is_exact_match:
                    tasks_to_remove.append(t)
                    for sid in t["section_ids"]:
                        if not any(l["day"] == lock_day and l["label"] == lock_label for l in section_locks[sid]):
                            section_locks[sid].append({
                                "day": lock_day, 
                                "label": lock_label, 
                                "task": t,
                                "start_slot": start_slot,
                                "consecutive_slots": consecutive_slots
                            })
                else:
                    for sid in t["section_ids"]:
                        if not any(l["day"] == lock_day and l["label"] == lock_label for l in section_locks[sid]):
                            section_locks[sid].append({
                                "day": lock_day, 
                                "label": lock_label, 
                                "task": None,
                                "start_slot": start_slot,
                                "consecutive_slots": consecutive_slots
                            })

    # Remove matched tasks from solver so they don't get duplicate CP-SAT slots
    tasks = [t for t in tasks if t not in tasks_to_remove]

    # ── PRE-SOLVE TEACHER CONFLICT DETECTION ───────────────────
    # Detect teachers who have multiple conflicting assignments that cannot be scheduled
    # This helps provide actionable error messages to users before running the solver
    teacher_assignments = defaultdict(list)  # teacher_id -> list of (subject_code, role, hours, sections)
    
    for task in tasks:
        # Track theory teacher assignments
        if task["teacher_id"] and task["theory_credits"] > 0:
            teacher_assignments[task["teacher_id"]].append({
                "subject": task["subject"].code,
                "role": "Theory Teacher",
                "hours": task["theory_credits"],
                "sections": [section_map[sid].display_name for sid in task["section_ids"]],
                "batch": f"{task['batch_year']}{task['dept_code']}"
            })
        
        # Track lab engineer assignments
        if task["lab_engineer_id"] and task["lab_credits"] > 0:
            teacher_assignments[task["lab_engineer_id"]].append({
                "subject": task["subject"].code,
                "role": "Lab Engineer",
                "hours": task["lab_credits"] * 3,  # Lab credits × 3 contact hours
                "sections": [section_map[sid].display_name for sid in task["section_ids"]],
                "batch": f"{task['batch_year']}{task['dept_code']}"
            })
    
    # Check for teachers with excessive workload that might cause conflicts
    teacher_conflicts = []
    for teacher_id, assignments in teacher_assignments.items():
        total_hours = sum(a["hours"] for a in assignments)
        teacher = teacher_map.get(teacher_id)
        teacher_name = teacher.name if teacher else f"Teacher ID {teacher_id}"
        
        # Check if teacher has too many hours (more than available slots)
        # Available slots: 32 total (28 Mon-Thu + 4 Fri) minus restrictions
        available_slots = 32 - len(restricted_slots.get(teacher_id, set()))
        
        if total_hours > available_slots:
            teacher_conflicts.append({
                "teacher": teacher_name,
                "teacher_id": teacher_id,
                "total_hours": total_hours,
                "available_slots": available_slots,
                "assignments": assignments
            })
        # NOTE: Multiple assignments in the same batch is NOT a conflict
        # Teachers can teach multiple subjects to the same batch at different times
        # Only flag as conflict if total hours exceed available slots (checked above)

    # ── Decision Variables ──────────────────────────────────────
    # Indices: ti = task index, d = day, s = slot, ls = lab_start
    x_theory = {} # (ti, d, s) -> IntVar
    x_lab = {}    # (ti, d, ls) -> IntVar
    
    # Efficient tracking for constraints
    vars_by_task = defaultdict(list)
    vars_by_task_day = defaultdict(lambda: defaultdict(list))
    lab_vars_by_task = defaultdict(list)
    
    # Tracks which variable is active for which section/teacher/room at (d, s)
    # Map: day -> slot -> item_id -> list of variables
    teacher_vars_at = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    section_vars_at = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    room_vars_at = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    
    # vars_by_task_day[ti][d][s] = var
    vars_by_task_day = defaultdict(lambda: defaultdict(dict))

    penalties = []

    # Combination variable reuse
    comb_theory_vars = {} # (combination_id, d, s) -> IntVar
    comb_lab_vars = {}    # (combination_id, d, ls) -> IntVar

    # First, identify which slots are available for a COMBINATION as a whole
    # (Must be free for all involved teachers)
    comb_free_slots = defaultdict(lambda: defaultdict(bool)) # (comb_id, d, s) -> bool
    comb_free_lab_starts = defaultdict(lambda: defaultdict(bool)) # (comb_id, d, ls) -> bool
    
    groups = defaultdict(list)
    for ti, task in enumerate(tasks):
        cid = task.get("combination_id")
        if cid: groups[cid].append(task)
    
    for cid, g_tasks in groups.items():
        for d in DAYS:
            for s in schedulable_slots[d]:
                if all((d, s) not in restricted_slots[t["teacher_id"]] for t in g_tasks):
                    comb_free_slots[cid, d, s] = True
            for ls in lab_starts[d]:
                all_free = True
                for t in g_tasks:
                   for offset in range(3):
                       if (d, ls + offset) in restricted_slots[t["teacher_id"]]:
                           all_free = False; break
                       if t["lab_engineer_id"] and (d, ls + offset) in restricted_slots[t["lab_engineer_id"]]:
                           all_free = False; break
                   if not all_free: break
                if all_free: comb_free_lab_starts[cid, d, ls] = True
        
    for ti, task in enumerate(tasks):
        comb_id = task.get("combination_id")

        # Theory variables
        if task["theory_credits"] > 0:
            for d in DAYS:
                is_fyp_restricted_days = []
                for sid in task["section_ids"]:
                    if sid in section_locks:
                        is_fyp_restricted_days.extend([lock["day"] for lock in section_locks[sid]])
                
                if d in is_fyp_restricted_days: continue
                
                # Check if this day is a configured morning lab day for this batch
                # For STRICT mode: theory must start from slot 4 on ALL configured days
                # For PREFER mode: theory can use all slots (labs just prefer morning)
                batch_id = task["assignment"].batch_id
                batch_config = batch_morning_lab_config.get(batch_id)
                min_theory_slot = 0
                
                if batch_config and batch_config.get("mode") == "strict":
                    config_days = batch_config.get("days", [])
                    # If this day is in the configured morning lab days
                    if not config_days or d in config_days:
                        # Theory must start from slot 4 (after morning lab block + break)
                        # Slots 0-1-2 = morning lab block (or empty if fewer labs than days)
                        # Slot 3 = break (30 minutes)
                        # Slot 4+ = theory classes
                        # This reserves morning slots for consistency across all configured days
                        min_theory_slot = 4
                    
                for s in schedulable_slots[d]:
                    # Skip slots before minimum theory slot
                    if s < min_theory_slot:
                        continue
                    
                    # Check if teacher is restricted and their restriction mode
                    teacher_restricted = False
                    teacher_strict_mode = False
                    if comb_id:
                        if not comb_free_slots[comb_id, d, s]: continue
                    else:
                        teacher_restricted = (d, s) in restricted_slots[task["teacher_id"]]
                        teacher_strict_mode = teacher_restriction_modes.get(task["teacher_id"], "preferred") == "strict"
                        
                        # If teacher is in STRICT mode and slot is restricted, skip it completely
                        if teacher_restricted and teacher_strict_mode:
                            continue  # Absolute block - don't create variable
                        # If teacher is in PREFERRED mode and slot is restricted, allow with penalty
                        
                    v = None
                    if comb_id:
                        if (comb_id, d, s) in comb_theory_vars:
                            v = comb_theory_vars[comb_id, d, s]
                        else:
                            v = model.NewBoolVar(f"th_comb_{comb_id}_{d}_{s}")
                            comb_theory_vars[comb_id, d, s] = v
                            penalties.append(v * (s * s * early_slot_penalty))
                    else:
                        v = model.NewBoolVar(f"th_{ti}_{d}_{s}")
                        penalties.append(v * (s * s * early_slot_penalty))
                        
                        # Add heavy penalty if teacher is restricted at this slot (PREFERRED mode only)
                        # Solver will avoid this but can use it if no alternative exists
                        if teacher_restricted:  # Already filtered strict mode above
                            penalties.append(v * 50000)  # Very high penalty for using restricted teacher

                    x_theory[ti, d, s] = v
                    vars_by_task[ti].append(v)
                    vars_by_task_day[ti][d][s] = v
                    
                    # ═══════════════════════════════════════════════════════════════
                    # THEORY TEACHER BLOCKING - DO NOT MODIFY
                    # ═══════════════════════════════════════════════════════════════
                    # RULE: Theory teacher is ONLY blocked during their theory slots
                    # Theory teacher is NEVER blocked during lab time (even if same subject)
                    # See lab blocking section (lines 560-595) for lab engineer blocking
                    # ═══════════════════════════════════════════════════════════════
                    
                    if task["teacher_id"]:
                        teacher_vars_at[d][s][task["teacher_id"]].append(v)
                    for sid in task["section_ids"]:
                        section_vars_at[d][s][sid].append(v)
                    if task["room_id"]:
                        room_vars_at[d][s][task["room_id"]].append(v)

        # Lab variables
        if task["lab_credits"] > 0:
            # Get batch configuration for this task
            batch_id = task["assignment"].batch_id
            batch_config = batch_morning_lab_config.get(batch_id)
            
            for d in DAYS:
                is_fyp_restricted_days = []
                for sid in task["section_ids"]:
                    if sid in section_locks:
                        is_fyp_restricted_days.extend([lock["day"] for lock in section_locks[sid]])
                
                if d in is_fyp_restricted_days: continue

                # GENERALIZED RULE: No regular subject labs on Friday (unless allow_friday_labs is enabled)
                # (FYP and other special projects are handled separately via FYP rules)
                if d == 4 and not allow_friday_labs:
                    continue
                
                # ── Determine morning lab configuration using batch-level settings ──
                # Initialize is_morning_day to False (default: no morning lab preference)
                is_morning_day = False
                
                # Check if batch has morning lab configuration
                if batch_config:
                    mode = batch_config["mode"]
                    config_days = batch_config["days"]
                    
                    # Check if this day is in the configured days (empty list means all days)
                    is_morning_day = not config_days or d in config_days
                    
                    # Determine allowed lab starts based on mode
                    if mode == "strict" and is_morning_day:
                        # Strict mode: ONLY allow morning lab start (slot 0)
                        allowed_lab_starts = [0]
                    else:
                        # Prefer or count mode: allow all lab starts
                        allowed_lab_starts = list(lab_starts[d])
                        # If morning day, it means morning lab (slot 0) should be an option
                        if is_morning_day and 0 not in allowed_lab_starts:
                            allowed_lab_starts.insert(0, 0)
                            
                        # BUT: if this is a configured morning day, block slot 3 (it's the break)
                        if is_morning_day and 3 in allowed_lab_starts:
                            # Remove slot 3 - it's reserved for break on morning lab days
                            allowed_lab_starts = [ls for ls in allowed_lab_starts if ls != 3]
                else:
                    # No batch config - use default behavior
                    allowed_lab_starts = lab_starts[d]
                
                for ls in allowed_lab_starts:
                    # Check for lab engineer restrictions and their mode
                    lab_engineer_restricted = False
                    lab_engineer_strict_mode = False
                    
                    if comb_id:
                        if not comb_free_lab_starts[comb_id, d, ls]: continue
                    else:
                        # Check if lab engineer is restricted at any of the 3 lab slots
                        if task["lab_engineer_id"]:
                            lab_engineer_strict_mode = teacher_restriction_modes.get(task["lab_engineer_id"], "preferred") == "strict"
                            for offset in range(3):
                                slot = ls + offset
                                if (d, slot) in restricted_slots[task["lab_engineer_id"]]:
                                    lab_engineer_restricted = True
                                    break
                            
                            # If lab engineer is in STRICT mode and any lab slot is restricted, skip completely
                            if lab_engineer_restricted and lab_engineer_strict_mode:
                                continue  # Absolute block - don't create variable
                        # If lab engineer is in PREFERRED mode and slot is restricted, allow with penalty
                        
                    v = None
                    if comb_id:
                        if (comb_id, d, ls) in comb_lab_vars:
                            v = comb_lab_vars[comb_id, d, ls]
                        else:
                            v = model.NewBoolVar(f"lab_comb_{comb_id}_{d}_{ls}")
                            comb_lab_vars[comb_id, d, ls] = v
                            penalties.append(v * ((max_slots_per_day - ls) * lab_priority_multiplier))
                            if is_morning_day: penalties.append(v * (ls * 100))
                    else:
                        v = model.NewBoolVar(f"lab_{ti}_{d}_{ls}")
                        penalties.append(v * ((max_slots_per_day - ls) * lab_priority_multiplier))
                        if is_morning_day: penalties.append(v * (ls * 100))
                        
                        # Add heavy penalty if lab engineer is restricted at this slot (PREFERRED mode only)
                        # Solver will avoid this but can use it if no alternative exists
                        if lab_engineer_restricted:  # Already filtered strict mode above
                            penalties.append(v * 50000)  # Very high penalty for using restricted lab engineer

                    x_lab[ti, d, ls] = v
                    lab_vars_by_task[ti].append(v)
                    
                    for offset in range(3):
                        s = ls + offset
                        
                        # ═══════════════════════════════════════════════════════════════
                        # CRITICAL TEACHER BLOCKING RULE - DO NOT MODIFY
                        # ═══════════════════════════════════════════════════════════════
                        # 
                        # RULE: Teachers are ONLY blocked during slots they are ASSIGNED to
                        #
                        # For LABS (3-hour blocks):
                        #   - ONLY the lab_engineer_id is blocked during lab slots
                        #   - Theory teacher (teacher_id) is NEVER blocked during lab time
                        #   - Lab is a separate 3-hour block supervised by lab engineer only
                        #
                        # For THEORY (1-hour slots):
                        #   - ONLY the teacher_id is blocked during theory slots (see line 477)
                        #   - Lab engineer is NEVER blocked during theory time
                        #
                        # Example: Subject with 3+1 credits (3 theory + 1 lab)
                        #   - Theory teacher teaches 3 theory hours (blocked during those 3 slots)
                        #   - Lab engineer teaches 1 lab (3 contact hours, blocked during those 3 slots)
                        #   - Theory teacher is FREE during lab time
                        #   - Lab engineer is FREE during theory time
                        #
                        # WHY THIS MATTERS:
                        #   - Prevents false teacher conflicts
                        #   - Allows theory teachers to teach other classes during lab time
                        #   - Correctly models real-world teaching assignments
                        #
                        # THIS RULE WAS CORRECT AND DID NOT CAUSE INFEASIBLE ERRORS
                        # The INFEASIBLE error was caused by no-gaps HARD constraint
                        # being too restrictive with strict mode + shared teachers
                        # ═══════════════════════════════════════════════════════════════
                        
                        if task["lab_engineer_id"]:
                            teacher_vars_at[d][s][task["lab_engineer_id"]].append(v)
                        
                        for sid in task["section_ids"]:
                            section_vars_at[d][s][sid].append(v)
                        if task["room_id"]:
                            room_vars_at[d][s][task["room_id"]].append(v)

    # ── DYNAMIC BREAK CONSTRAINT (Morning Lab) ─────────────────────
    # By default, slot `break_slot` (index 2) is excluded from schedulable_slots,
    # so theory is never placed there. However, morning labs (start=0) DO occupy
    # slot 2 via the lab variable (slots 0,1,2). On those days, slot 3 becomes
    # the effective break for that section.
    #
    # Simple rule: if a morning-lab variable is scheduled for a section on day d,
    # then NO theory class can be at slot 3 for those sections on that day.
    # All other sections on that day keep the normal break at slot 2.
    for ti, task in enumerate(tasks):
        if task["lab_credits"] <= 0:
            continue
        for d in range(4):  # Mon-Thu only
            if (ti, d, 0) not in x_lab:
                continue
            morning_lab_v = x_lab[ti, d, 0]
            # For every section in this task, block theory at slot 3 if morning lab runs
            for sid in task["section_ids"]:
                for t2, task2 in enumerate(tasks):
                    if sid not in task2["section_ids"]:
                        continue
                    if (t2, d, 3) in x_theory:
                        # morning_lab_v + theory_at_slot3 <= 1
                        model.Add(morning_lab_v + x_theory[t2, d, 3] <= 1)
                    # Removed HARD constraint blocking slots 6 and 7 to allow classes to spread and balance easily

    # ── No Consecutive Lab Days ───────────────────────────────────────
    # Avoid scheduling labs on back-to-back days for the same section/task.
    # e.g. if lab is on Monday (d=0), strongly discourage lab on Tuesday (d=1).
    CONSEC_LAB_PENALTY = 2000  # Strong soft penalty
    for ti, task in enumerate(tasks):
        if task["lab_credits"] <= 0:
            continue
        for d in range(3):  # Mon, Tue, Wed (d and d+1 must both be < 4)
            for ls in lab_starts[d]:
                if (ti, d, ls) not in x_lab:
                    continue
                lab_v1 = x_lab[ti, d, ls]
                for ls2 in lab_starts[d + 1]:
                    if (ti, d + 1, ls2) not in x_lab:
                        continue
                    lab_v2 = x_lab[ti, d + 1, ls2]
                    # Both labs active on consecutive days = big penalty
                    both = model.NewBoolVar(f"consec_lab_{ti}_{d}_{ls}_{ls2}")
                    model.AddMinEquality(both, [lab_v1, lab_v2])
                    penalties.append(both * CONSEC_LAB_PENALTY)

    # ── Lab Is Last: No Theory After Lab on the Same Day ─────────────
    # If a lab block (start=ls, occupies ls, ls+1, ls+2) is scheduled on day d,
    # then NO theory class can be at any slot > ls+2 for those sections on day d.
    # This enforces: Theory classes → Lab → END (lab is always last activity).
    # For morning labs (ls=0), the lab ends at slot 2, break is at slot 3, 
    # and slots 4 and 5 may have theory (allowed by separate early-dismissal logic).
    # So this rule only applies for AFTERNOON labs (ls >= 3).
    if lab_is_last:
        for ti, task in enumerate(tasks):
            if task["lab_credits"] <= 0:
                continue
            for d in DAYS:
                for ls in lab_starts[d]:
                    if ls == 0:
                        continue  # Morning labs allow theory after break (slots 4,5)
                    if (ti, d, ls) not in x_lab:
                        continue
                    lab_v = x_lab[ti, d, ls]
                    lab_end = ls + 2  # Last slot occupied by the lab (ls, ls+1, ls+2)
                    # Block theory at any slot after the lab ends for all shared sections
                    for sid in task["section_ids"]:
                        for t2, task2 in enumerate(tasks):
                            if sid not in task2["section_ids"]:
                                continue
                            if task2["theory_credits"] <= 0:
                                continue
                            for s_after in range(lab_end + 1, (max_slots_per_day or 8)):
                                if (t2, d, s_after) in x_theory:
                                    model.Add(lab_v + x_theory[t2, d, s_after] <= 1)

    # ── Uniform Lab Starts (Early Finish Classes) ───────────────────
    # For requested batch IDs, all afternoon labs across the week must start at the exact same slot.
    if uniform_lab_start_batch_ids:
        # Get set of batches that need uniform afternoon labs
        uniform_batches = set(uniform_lab_start_batch_ids)
        
        # Track afternoon lab variables per batch
        # Map: batch_id -> list of (var, start_slot)
        batch_afternoon_labs = defaultdict(list)
        
        for ti, task in enumerate(tasks):
            batch_id = task["assignment"].batch_id
            if batch_id in uniform_batches and task["lab_credits"] > 0:
                for d in DAYS:
                    for ls in lab_starts[d]:
                        if ls >= 3:  # Only afternoon labs
                            if (ti, d, ls) in x_lab:
                                batch_afternoon_labs[batch_id].append((x_lab[ti, d, ls], ls))
        
        # Add constraint linking the labs to a single slot for the batch
        for batch_id, lab_vars_info in batch_afternoon_labs.items():
            if not lab_vars_info:
                continue
                
            # Create a variable to represent the uniform start slot for this batch
            # Domain is all possible afternoon lab start slots across the week for this batch
            possible_starts = sorted(list(set([ls for _, ls in lab_vars_info])))
            if not possible_starts:
                continue
                
            uniform_start_var = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(possible_starts), 
                f"uniform_lab_start_batch_{batch_id}"
            )
            
            # For every afternoon lab variable for this batch
            for lab_var, ls in lab_vars_info:
                # If this lab slot is scheduled, the batch's uniform start MUST equal this slot's index
                # (lab_var == 1) => (uniform_start_var == ls)
                model.Add(uniform_start_var == ls).OnlyEnforceIf(lab_var)
                
            # ── Strictly Cap Theory Classes on ALL Days (Mon-Thu) ──
            # Prevent *any* theory class from occurring at or after the uniform_start_var.
            # Classes must finish EARLY, before the lab starts.
            for ti, task in enumerate(tasks):
                if task["assignment"].batch_id == batch_id and task["theory_credits"] > 0:
                    for d in range(4):  # Mon-Thu only 
                        for s in schedulable_slots[d]:
                            if (ti, d, s) in x_theory:
                                # Logic: theory slot must be strictly before the uniform lab start
                                model.Add(s < uniform_start_var).OnlyEnforceIf(x_theory[ti, d, s])

    # ── Morning Lab Day Fill (Always-On Load Balancing) ──────────────
    # Rule: If section S has a morning lab on Day X, and S has theory tasks at all,
    #       the solver should fill at least 1 slot (4 or 5) on Day X before overloading
    #       other days (Y, Z) with 2+ lectures after break.
    #
    # Implementation: Penalise "morning-lab day with zero afternoon theory" heavily.
    # This makes the solver prefer moving 1 lecture from Y/Z to Day X.
    # Penalty must be > cost of adding a class on another day (day-usage + last-slot).
    # We set it to 800 (DAY_USAGE_PENALTY=150 + CLUSTER_BONUS=500 + buffer).
    MORNING_EMPTY_PENALTY = 800

    # Build section → theory task indices (for checking if section has any theory)
    section_theory_tasks = defaultdict(list)
    for ti, task in enumerate(tasks):
        if task["theory_credits"] > 0:
            for sid in task["section_ids"]:
                section_theory_tasks[sid].append(ti)

    for ti, task in enumerate(tasks):
        if task["lab_credits"] <= 0:
            continue
        for d in range(4):  # Mon-Thu only
            if (ti, d, 0) not in x_lab:
                continue
            morning_lab_v = x_lab[ti, d, 0]

            for sid in task["section_ids"]:
                # Collect all theory variables at slots 4 and 5 for this section on day d
                slots_4_5_vars = []
                for t2 in section_theory_tasks.get(sid, []):
                    for preferred_slot in [4, 5]:
                        if (t2, d, preferred_slot) in x_theory:
                            slots_4_5_vars.append(x_theory[t2, d, preferred_slot])

                if not slots_4_5_vars:
                    continue  # No theory could ever be on this day — skip

                # day_afternoon_empty = 1 when no theory at slots 4 or 5 on this day
                day_afternoon_empty = model.NewBoolVar(f"morning_empty_{sid}_{d}")
                model.Add(sum(slots_4_5_vars) == 0).OnlyEnforceIf(day_afternoon_empty)
                model.Add(sum(slots_4_5_vars) >= 1).OnlyEnforceIf(day_afternoon_empty.Not())

                # Penalty fires when BOTH morning_lab_v=1 AND afternoon is empty
                both_empty = model.NewBoolVar(f"lab_and_empty_{sid}_{d}")
                model.AddMinEquality(both_empty, [morning_lab_v, day_afternoon_empty])
                penalties.append(both_empty * MORNING_EMPTY_PENALTY)

    # ── Constraints ─────────────────────────────────────────────
    # Debug: Print task information
    print(f"\n[SOLVER DEBUG] Total tasks: {len(tasks)}")
    subject_task_count = {}
    for ti, task in enumerate(tasks):
        subj_code = task["subject"].code
        section_names = [section_map[sid].display_name for sid in task["section_ids"] if sid in section_map]
        print(f"  Task {ti}: {subj_code} for sections {section_names}, Theory={task['theory_credits']}, Lab={task['lab_credits']}")
        subject_task_count[subj_code] = subject_task_count.get(subj_code, 0) + 1
    
    print(f"\n[SOLVER DEBUG] Tasks per subject:")
    for subj_code, count in subject_task_count.items():
        print(f"  {subj_code}: {count} tasks")
    print()
    
    for ti, task in enumerate(tasks):
        # Theory: slots must match credit hours EXACTLY (+ optional extra classes)
        tc_base = task["theory_credits"]  # Base credit hours from subject
        if tc_base > 0:
            t_vars = vars_by_task[ti]
            tc_target = tc_base + extra_classes_per_subject  # Target slots
            
            if t_vars:
                # HARD CONSTRAINT: Theory classes must be EXACTLY tc_target
                # A 3-credit subject gets exactly 3 slots (or 3+extra if extra is set)
                model.Add(sum(t_vars) == tc_target)
                
                # No soft penalties needed - this is a hard requirement

            # Different days: at most 1 theory slot per day (unless consecutive lectures enabled)
            consecutive_count = task["assignment"].consecutive_lectures
            
            if consecutive_count in [2, 3]:
                # CONSECUTIVE LECTURES CONSTRAINT
                # If consecutive_lectures is 2 or 3, enforce that theory slots are consecutive
                # Example: 2 consecutive = slots 4-5, 1-2, 5-6, etc.
                # Example: 3 consecutive = slots 4-5-6, 0-1-2, etc.
                
                # For each day, check if we can place consecutive slots
                for d in DAYS:
                    d_vars_dict = vars_by_task_day[ti][d]
                    if not d_vars_dict:
                        continue
                    
                    # Find all possible consecutive slot combinations on this day
                    slots_on_day = sorted(d_vars_dict.keys())
                    consecutive_groups = []
                    
                    for i in range(len(slots_on_day) - consecutive_count + 1):
                        # Check if slots are truly consecutive (no gaps)
                        group = slots_on_day[i:i+consecutive_count]
                        is_consecutive = all(group[j+1] == group[j] + 1 for j in range(len(group)-1))
                        
                        if is_consecutive:
                            consecutive_groups.append(group)
                    
                    if consecutive_groups:
                        # Create a variable for each valid consecutive group
                        group_vars = []
                        for group in consecutive_groups:
                            group_var = model.NewBoolVar(f"consec_{ti}_{d}_{'_'.join(map(str, group))}")
                            # If this group is active, all slots in the group must be active
                            for slot in group:
                                model.Add(d_vars_dict[slot] == 1).OnlyEnforceIf(group_var)
                            # If any slot in group is active, the group must be active
                            model.Add(sum(d_vars_dict[s] for s in group) >= consecutive_count).OnlyEnforceIf(group_var)
                            model.Add(sum(d_vars_dict[s] for s in group) < consecutive_count).OnlyEnforceIf(group_var.Not())
                            group_vars.append(group_var)
                        
                        # On this day, either no slots are used OR exactly one consecutive group is used
                        day_slot_count = sum(d_vars_dict.values())
                        day_has_classes = model.NewBoolVar(f"day_has_classes_{ti}_{d}")
                        model.Add(day_slot_count > 0).OnlyEnforceIf(day_has_classes)
                        model.Add(day_slot_count == 0).OnlyEnforceIf(day_has_classes.Not())
                        
                        # If day has classes, exactly one consecutive group must be active
                        model.Add(sum(group_vars) == 1).OnlyEnforceIf(day_has_classes)
                        model.Add(sum(group_vars) == 0).OnlyEnforceIf(day_has_classes.Not())
            else:
                # Normal behavior: at most 1 theory slot per day
                for d in DAYS:
                    d_vars_dict = vars_by_task_day[ti][d]
                    if d_vars_dict:
                        model.Add(sum(d_vars_dict.values()) <= 1)
        
        # Lab: Schedule exactly lab_credits blocks of 3 contiguous slots each
        if task["lab_credits"] > 0:
            l_vars = lab_vars_by_task[ti]
            lab_count = task["lab_credits"]
            
            if l_vars:
                # HARD CONSTRAINT: Must schedule exactly lab_credits lab blocks
                # e.g. lab_credits=1 → 1 block (3 slots), lab_credits=2 → 2 blocks (6 slots)
                model.Add(sum(l_vars) == lab_count)
                
                # SOFT: Prefer at most 1 lab block per day per task (spread across days)
                if lab_count > 1:
                    for d in DAYS:
                        day_lab_vars = [v for (t, dd, ls), v in x_lab.items() if t == ti and dd == d]
                        if len(day_lab_vars) > 1:
                            double_lab = model.NewBoolVar(f"double_lab_{ti}_{d}")
                            model.Add(sum(day_lab_vars) >= 2).OnlyEnforceIf(double_lab)
                            model.Add(sum(day_lab_vars) < 2).OnlyEnforceIf(double_lab.Not())
                            penalties.append(double_lab * 50000)  # Strong penalty for 2 labs same day
            else:
                print(f"  - WARNING: Task {ti} ({task['subject'].code}) has NO possible lab slots.")

    # Clash constraints (Section, Teacher, Room)
    for d in DAYS:
        for s in schedulable_slots[d]:
            # Teacher Clash
            for t_id, vars_list in teacher_vars_at[d][s].items():
                if len(vars_list) > 1:
                    # Use list(dict.fromkeys()) to deduplicate while preserving order
                    # This handles combined classes that share the same variable object
                    unique_vars = list(dict.fromkeys(vars_list))
                    model.Add(sum(unique_vars) <= 1)
            # Section Clash
            for sid, vars_list in section_vars_at[d][s].items():
                if len(vars_list) > 1:
                    unique_vars = list(dict.fromkeys(vars_list))
                    model.Add(sum(unique_vars) <= 1)
            # Room Clash
            for rid, vars_list in room_vars_at[d][s].items():
                if len(vars_list) > 1:
                    unique_vars = list(dict.fromkeys(vars_list))
                    model.Add(sum(unique_vars) <= 1)

    # Consecutive Classes Constraint
    # For teachers who don't allow consecutive classes, penalize back-to-back slots in the same batch
    for ti, task in enumerate(tasks):
        teacher_id = task["teacher_id"]
        if not teacher_id:
            continue
        
        teacher = teacher_map.get(teacher_id)
        if not teacher:
            continue
        
        # If teacher allows consecutive classes, skip penalty
        if teacher.allow_consecutive:
            continue
        
        # For each day, check for consecutive slots
        for d in DAYS:
            slots = schedulable_slots[d]
            for i in range(len(slots) - 1):
                s1, s2 = slots[i], slots[i + 1]
                
                # Check if variables exist for this teacher at these slots
                v1 = x_theory.get((ti, d, s1))
                v2 = x_theory.get((ti, d, s2))
                
                if v1 is not None and v2 is not None:
                    # Penalize if both slots are occupied (consecutive classes)
                    consec_var = model.NewBoolVar(f"consec_{ti}_{d}_{s1}_{s2}")
                    model.Add(consec_var >= v1 + v2 - 1)
                    penalties.append(consec_var * 10000)  # High penalty for consecutive classes

    # Re-build section_tasks map for specialized constraints
    section_tasks = defaultdict(list)
    for ti, task in enumerate(tasks):
        for sid in task["section_ids"]:
            section_tasks[sid].append(ti)

    # SOFT: Prefer at most 1 lab block per day for each section (across all subjects)
    for sec_id, t_indices in section_tasks.items():
        for d in DAYS:
            sec_day_lab_vars = []
            for ti in t_indices:
                for (t_i, dd, ls), v in x_lab.items():
                    if t_i == ti and dd == d:
                        sec_day_lab_vars.append(v)
            if len(sec_day_lab_vars) > 1:
                sec_double_lab = model.NewBoolVar(f"sec_dbl_lab_{sec_id}_{d}")
                model.Add(sum(sec_day_lab_vars) >= 2).OnlyEnforceIf(sec_double_lab)
                model.Add(sum(sec_day_lab_vars) < 2).OnlyEnforceIf(sec_double_lab.Not())
                penalties.append(sec_double_lab * 30000)  # Prefer spreading labs across days

    # Labs After Theory & Global No Gaps
    for sec_id, t_indices in section_tasks.items():
        # Check if this section has no_gaps policy enabled
        section_no_gaps = any(tasks[ti].get("no_gaps", True) for ti in t_indices)
        
        for d in DAYS:
            slots = schedulable_slots[d]
            
            # Identify which slots are occupied by this section on day d
            # Map: slot -> list of variables (theory or lab) that occupy it
            slot_occupied_vars = defaultdict(list)
            for ti in t_indices:
                # Theory
                if ti in vars_by_task_day and d in vars_by_task_day[ti]:
                    for s, th_var in vars_by_task_day[ti][d].items():
                        slot_occupied_vars[s].append(th_var)
                # Lab
                for (t_i, dd, ls) in x_lab:
                    if t_i == ti and dd == d:
                        for offset in range(3):
                            slot_occupied_vars[ls + offset].append(x_lab[t_i, dd, ls])
            
            # occupied[s] = BoolVar (True if any class is in slot s)
            occupied = {}
            for s in slots:
                if slot_occupied_vars[s]:
                    occ_v = model.NewBoolVar(f"occ_{sec_id}_{d}_{s}")
                    model.AddMaxEquality(occ_v, slot_occupied_vars[s])
                    occupied[s] = occ_v
            
            # Check if this section's batch has strict mode on this day
            sec = db.query(Section).get(sec_id)
            batch_config = batch_morning_lab_config.get(sec.batch_id) if sec else None
            is_strict_day = False
            
            if batch_config and batch_config.get("mode") == "strict":
                config_days = batch_config.get("days", [])
                is_strict_day = not config_days or d in config_days
            
            # No-Gaps Constraint: If s1 and s3 are occupied, s2 SHOULD be occupied
            # CHANGED: Always use SOFT constraint (penalty-based) instead of HARD
            # This allows solver to create gaps when necessary to satisfy other constraints
            # while still preferring no gaps via penalty
            if len(slots) > 2:
                for i in range(len(slots)):
                    for j in range(i + 2, len(slots)):
                        s1, s2_list, s3 = slots[i], slots[i+1:j], slots[j]
                        if s1 in occupied and s3 in occupied:
                            for s2 in s2_list:
                                if s2 in occupied:
                                    # SOFT CONSTRAINT: Gaps discouraged but allowed when needed
                                    gap_v = model.NewBoolVar(f"gap_{sec_id}_{d}_{s1}_{s2}_{s3}")
                                    model.Add(gap_v >= occupied[s1] + occupied[s3] - occupied[s2] - 1)
                                    penalties.append(gap_v * (gap_penalty * 50))
            
            # NEW: Penalize leading empty slots (empty slots at the start of the day)
            # This ensures classes start from slot 0 rather than leaving morning slots empty
            # EXCEPTION: Skip this penalty on strict morning lab days (classes should start from slot 4)
            batch_config = batch_morning_lab_config.get(sec.batch_id) if sec else None
            is_strict_day = False
            
            if batch_config and batch_config.get("mode") == "strict":
                config_days = batch_config.get("days", [])
                is_strict_day = not config_days or d in config_days
            
            # Only apply leading empty slots penalty if NOT a strict morning lab day
            if occupied and not is_strict_day:
                for i, s in enumerate(slots):
                    if s in occupied:
                        # For each occupied slot, penalize all earlier empty slots
                        for j in range(i):
                            s_early = slots[j]
                            if s_early in occupied:
                                # leading_empty = Bool(s is occupied AND s_early is NOT occupied)
                                leading_empty = model.NewBoolVar(f"leading_empty_{sec_id}_{d}_{s_early}_{s}")
                                model.Add(leading_empty >= occupied[s] - occupied[s_early])
                                # Very high penalty to force classes to start from slot 0
                                penalties.append(leading_empty * (gap_penalty * 100))

            # New: Daily Load Balancing for Section
            # Penalize days that are heavily loaded to encourage spreading classes.
            if occupied:
                daily_load = model.NewIntVar(0, len(slots), f"load_{sec_id}_{d}")
                model.Add(daily_load == sum(occupied.values()))
                
                # Friday constraint: Use UP TO max_slots_friday slots
                # SMART BEHAVIOR: Try to use max_slots_friday, but allow less if needed
                if d == 4 and sec_id not in section_locks:
                    # Maximum constraint: Friday can have at most max_slots_friday classes
                    model.Add(daily_load <= max_slots_friday)
                    
                    # SOFT: Strongly encourage using all Friday slots
                    # Penalize each unused Friday slot heavily
                    friday_unused = model.NewIntVar(0, max_slots_friday, f"friday_unused_{sec_id}")
                    model.Add(friday_unused == max_slots_friday - daily_load)
                    penalties.append(friday_unused * 50000)  # Heavy penalty for unused Friday slots
                
                # A simple soft penalty: the penalty increases with the load.
                overload = model.NewIntVar(0, len(slots), f"overload_{sec_id}_{d}")
                model.AddMaxEquality(overload, [0, daily_load - 3])
                penalties.append(overload * 2000) # Penalize having more than 3 classes a day
                
                # And a small general penalty for every class on a day to slightly spread them
                penalties.append(daily_load * 200)
                
                # SOFT: Extremely heavy penalty for empty Mon-Thu days
                # This MUST dominate all other soft penalties combined
                if d < 4:  # Mon-Thu only
                    empty_day = model.NewBoolVar(f"empty_{sec_id}_{d}")
                    model.Add(daily_load == 0).OnlyEnforceIf(empty_day)
                    model.Add(daily_load > 0).OnlyEnforceIf(empty_day.Not())
                    penalties.append(empty_day * 5000000)  # 5M — absolutely dominant

            # New: Compact Morning (Hard Constraint)
            # If enabled, classes MUST start from slot 0 and be continuous.
            if compact_morning:
                for i in range(1, len(slots)):
                    curr, prev = slots[i], slots[i-1]
                    if curr in occupied and prev in occupied:
                        # occupied[curr] must be <= occupied[prev]
                        # This means you can't have a class in a later slot if the previous one is empty.
                        model.Add(occupied[curr] <= occupied[prev])

            # Theory and Lab for the same subject can be on different days.
            # No same-day ordering constraint needed.

    # Teacher workload constraint REMOVED - solver should ignore teacher max hours
    # Workload is tracked for display purposes only, not enforced during generation

    # ── Early Dismissal Optimization (Mon-Thu only) ────────────────
    # ADAPTIVE BEHAVIOR: Automatically disable for Friday ≤ 3
    # With limited Friday slots, early dismissal creates over-constrained problems
    # The solver needs maximum flexibility to find ANY feasible solution
    if prefer_early_dismissal and max_slots_friday > 3:
        # ═══════════════════════════════════════════════════════════════
        # EARLY DISMISSAL = BALANCE END TIMES ACROSS DAYS
        # ═══════════════════════════════════════════════════════════════
        # Goal: Minimize variance in end times
        # Example: Prefer all days ending at 15:00 rather than 3 days at 14:00 and 1 day at 16:00
        #
        # Strategy: Track the last occupied slot on each day, then penalize differences
        #
        # NOTE: This optimization is DISABLED when Friday ≤ 3 slots
        # With limited Friday capacity, the solver needs maximum flexibility
        # to find feasible solutions. Early dismissal balancing would over-constrain.
        # ═══════════════════════════════════════════════════════════════
        
        for sec_id, t_indices in section_tasks.items():
            # Track which slots are occupied on each day
            day_occupied_slots = {}  # day -> {slot -> occupied_var}
            day_end_times = {}  # day -> IntVar representing last occupied slot
            
            for d in range(4):  # Mon-Thu only
                slots = schedulable_slots[d]
                if not slots:
                    continue

                slot_occupied_vars = defaultdict(list)
                for ti in t_indices:
                    if ti in vars_by_task_day and d in vars_by_task_day[ti]:
                        for s, th_var in vars_by_task_day[ti][d].items():
                            slot_occupied_vars[s].append(th_var)
                    for (t_i, dd, ls) in x_lab:
                        if t_i == ti and dd == d:
                            for offset in range(3):
                                slot_occupied_vars[ls + offset].append(x_lab[t_i, dd, ls])

                occupied = {}
                for s in slots:
                    if slot_occupied_vars[s]:
                        occ_v = model.NewBoolVar(f"early_occ_{sec_id}_{d}_{s}")
                        model.AddMaxEquality(occ_v, list(dict.fromkeys(slot_occupied_vars[s])))
                        occupied[s] = occ_v
                
                day_occupied_slots[d] = occupied
                
                # Calculate end time for this day (last occupied slot)
                # If no slots occupied, end time = 0
                if occupied:
                    end_time = model.NewIntVar(0, 8, f"end_time_{sec_id}_{d}")
                    # end_time = max slot index where occupied[slot] = 1
                    # We'll use: if slot S is occupied, end_time >= S+1
                    for s in occupied:
                        model.Add(end_time >= (s + 1)).OnlyEnforceIf(occupied[s])
                    # Also ensure end_time is not larger than necessary
                    for s in occupied:
                        # If slot s is the last occupied, end_time should be s+1
                        all_later_empty = []
                        for s2 in occupied:
                            if s2 > s:
                                all_later_empty.append(occupied[s2].Not())
                        if all_later_empty:
                            is_last = model.NewBoolVar(f"is_last_{sec_id}_{d}_{s}")
                            model.AddBoolAnd(all_later_empty).OnlyEnforceIf(is_last)
                            model.Add(end_time == s + 1).OnlyEnforceIf([is_last, occupied[s]])
                    
                    day_end_times[d] = end_time
            
            # ═══════════════════════════════════════════════════════════════
            # BALANCE END TIMES AROUND AVERAGE
            # ═══════════════════════════════════════════════════════════════
            # Calculate average end time across all days
            # Then penalize each day's distance from the average
            # This naturally balances: 14,14,16 → avg=14.67 → moves to 14,15,15
            # ═══════════════════════════════════════════════════════════════
            
            days_with_end_times = list(day_end_times.keys())
            if len(days_with_end_times) >= 2:
                # Calculate average end time (we'll approximate using integer division)
                # avg = sum(end_times) / count
                total_end_time = sum(day_end_times.values())
                num_days = len(days_with_end_times)
                
                # For each day, penalize distance from average
                # We can't divide in OR-Tools, so we'll use: |day_end * num_days - total_end|
                # This is equivalent to |day_end - avg| * num_days
                for d in days_with_end_times:
                    # Calculate: day_end_times[d] * num_days - total_end_time
                    scaled_diff = model.NewIntVar(-100, 100, f"scaled_diff_{sec_id}_{d}")
                    model.Add(scaled_diff == day_end_times[d] * num_days - total_end_time)
                    
                    # Get absolute value
                    abs_scaled_diff = model.NewIntVar(0, 100, f"abs_scaled_diff_{sec_id}_{d}")
                    model.AddAbsEquality(abs_scaled_diff, scaled_diff)
                    
                    # Apply HIGH penalty for deviation from average
                    # This enforces strict balance when Friday has sufficient slots
                    penalties.append(abs_scaled_diff * 10000000)



        # PART 2: Morning-Lab Day Clustering Bonus
        # When a morning lab is on Day D, theory at slots 4 or 5 on that SAME Day D
        # earns a large reward. This makes the solver heavily prefer placing theory
        # on morning-lab days instead of other days.
        CLUSTER_BONUS = 500
        for ti, task in enumerate(tasks):
            if task["lab_credits"] <= 0:
                continue
            for d in range(4):
                if (ti, d, 0) not in x_lab:
                    continue
                morning_lab_v = x_lab[ti, d, 0]
                for t2, task2 in enumerate(tasks):
                    if task2["theory_credits"] <= 0:
                        continue
                    shared = set(task["section_ids"]) & set(task2["section_ids"])
                    if not shared:
                        continue
                    for preferred_slot in [4, 5]:
                        if (t2, d, preferred_slot) in x_theory:
                            theory_v = x_theory[t2, d, preferred_slot]
                            both = model.NewBoolVar(f"cluster_{ti}_{t2}_{d}_{preferred_slot}")
                            model.AddMinEquality(both, [morning_lab_v, theory_v])
                            penalties.append(both * (-CLUSTER_BONUS))

    # ── Day Balancing: Early Dismissal Optimization ──────────────────
    # Penalize imbalanced day lengths to encourage even distribution of classes
    # Goal: Move classes from fuller days to emptier days for consistent dismissal times
    # 
    # Example: If Mon ends at slot 4, Thu ends at slot 8
    #   → High penalty encourages moving classes from Thu to Mon
    #   → Result: More balanced schedule (e.g., all days end around slot 6-7)
    
    DAY_BALANCE_PENALTY = 8000  # High penalty for each slot of imbalance
    
    # Track last slot used per section per day
    section_last_slots = {}  # (section_id, day) -> IntVar
    
    for sid in all_sections:
        section_id = sid.id
        
        for d in DAYS:
            # Find all slots used by this section on this day
            slot_indicators = []
            
            for ti, task in enumerate(tasks):
                if section_id not in task["section_ids"]:
                    continue
                
                # Theory slots
                for s in schedulable_slots[d]:
                    if (ti, d, s) in x_theory:
                        v = x_theory[ti, d, s]
                        # If this slot is used, it contributes (s+1) to last slot
                        # We use (s+1) because slot 0 should count as 1, not 0
                        slot_val = model.NewIntVar(0, max_slots_per_day, f"slot_val_{section_id}_{d}_{ti}_{s}")
                        model.Add(slot_val == s + 1).OnlyEnforceIf(v)
                        model.Add(slot_val == 0).OnlyEnforceIf(v.Not())
                        slot_indicators.append(slot_val)
                
                # Lab slots (3-hour blocks)
                for ls in lab_starts[d]:
                    if (ti, d, ls) in x_lab:
                        v = x_lab[ti, d, ls]
                        # Lab occupies slots ls, ls+1, ls+2
                        # Last slot is ls+2, so we use ls+3 (since we're using s+1 convention)
                        lab_end = ls + 3
                        lab_val = model.NewIntVar(0, max_slots_per_day, f"lab_val_{section_id}_{d}_{ti}_{ls}")
                        model.Add(lab_val == lab_end).OnlyEnforceIf(v)
                        model.Add(lab_val == 0).OnlyEnforceIf(v.Not())
                        slot_indicators.append(lab_val)
            
            if slot_indicators:
                # Last slot is the maximum of all slot indicators
                last_slot = model.NewIntVar(0, max_slots_per_day, f"last_slot_{section_id}_{d}")
                model.AddMaxEquality(last_slot, slot_indicators)
                section_last_slots[section_id, d] = last_slot
    
    # For each section, penalize imbalance between days
    for sid in all_sections:
        section_id = sid.id
        
        # Collect last slots for all days
        day_last_slots = []
        for d in DAYS:
            if (section_id, d) in section_last_slots:
                day_last_slots.append(section_last_slots[section_id, d])
        
        if len(day_last_slots) >= 2:
            # Calculate max and min last slot across days
            max_last = model.NewIntVar(0, max_slots_per_day, f"max_last_{section_id}")
            min_last = model.NewIntVar(0, max_slots_per_day, f"min_last_{section_id}")
            
            model.AddMaxEquality(max_last, day_last_slots)
            model.AddMinEquality(min_last, day_last_slots)
            
            # Imbalance = difference between longest and shortest day
            imbalance = model.NewIntVar(0, max_slots_per_day, f"imbalance_{section_id}")
            model.Add(imbalance == max_last - min_last)
            
            # Heavy penalty for each slot of imbalance
            # This encourages solver to balance days (e.g., move classes from Thu to Mon)
            penalties.append(imbalance * DAY_BALANCE_PENALTY)

    # ── Soft Penalty for Late Afternoon Slots (Slots 6 & 7) ──────────────
    # To strongly prevent classes stretching to 4pm/5pm when capacity exists elsewhere
    if prefer_early_dismissal:
        LATE_SLOT_PENALTY = 5000  # High enough to matter against Day Balance penalty
        
        for ti, task in enumerate(tasks):
            if task["theory_credits"] <= 0:
                continue
            for d in DAYS:
                for late_slot in [6, 7]:  # 3:30 PM & 4:30 PM slots
                    if late_slot in schedulable_slots[d]:
                        if (ti, d, late_slot) in x_theory:
                            # Add linear penalty for using a late slot
                            penalties.append(x_theory[ti, d, late_slot] * LATE_SLOT_PENALTY)

    # Solve
    # Increase penalty for shortfall to be absolute priority
    model.Minimize(sum(penalties))
    solver = cp_model.CpSolver()
    
    # INCREASED TIMEOUT: Give solver much more time to find solution
    solver.parameters.max_time_in_seconds = float(solver_timeout) * 5  # 5x longer (300 seconds default)
    
    # Performance optimizations - Make solver MUCH stronger
    solver.parameters.num_search_workers = 16  # Use more CPU cores for parallel search
    solver.parameters.log_search_progress = True  # Show progress
    solver.parameters.cp_model_presolve = True  # Enable presolve
    solver.parameters.linearization_level = 2  # Maximum linearization
    solver.parameters.cp_model_probing_level = 2  # More aggressive probing
    
    print(f"[SOLVER] Timeout: {solver.parameters.max_time_in_seconds}s, Workers: {solver.parameters.num_search_workers}")
    
    # Stronger solver settings for better solutions
    if prefer_early_dismissal:
        # When early dismissal is enabled, give solver even more time
        solver.parameters.max_time_in_seconds = float(solver_timeout) * 10
        print(f"[SOLVER] Early dismissal enabled - extended timeout to {solver.parameters.max_time_in_seconds}s")
    
    # Diagnostic logging
    print(f"[SOLVER] Tasks: {len(tasks)}, Theory vars: {len(x_theory)}, Lab vars: {len(x_lab)}")
    diagnostics = {
        "total_tasks": len(tasks),
        "theory_vars": len(x_theory),
        "lab_vars": len(x_lab),
        "tasks_detail": []
    }
    
    # ── PRE-VALIDATION: Detect impossible scenarios BEFORE solving ──
    pre_validation_errors = []
    
    # 0. Check for missing lab room assignments
    missing_lab_rooms = []
    for ti, task in enumerate(tasks):
        if task["lab_credits"] > 0:
            lab_room_id = task.get("lab_room_id")
            if not lab_room_id:
                subject_code = task['subject'].code
                sections = [section_map[sid].display_name for sid in task["section_ids"] if sid in section_map]
                sec_names = ", ".join(sections)
                missing_lab_rooms.append(f"• {subject_code} ({sec_names})")
    
    if missing_lab_rooms:
        error_msg = (
            "⚠️  MISSING LAB ROOM ASSIGNMENTS\n\n"
            "The following lab assignments do not have a lab room assigned:\n\n"
            + "\n".join(missing_lab_rooms) +
            "\n\nThe solver cannot schedule labs without a lab room assignment.\n\n"
            "SOLUTION:\n"
            "  1. Go to Assignments page\n"
            "  2. Edit each assignment listed above\n"
            "  3. Select a lab room from the 'Lab Room' dropdown\n"
            "  4. Save and try generating again"
        )
        print(f"[SOLVER PRE-VALIDATION FAILED]\n{error_msg}")
        raise ValueError(error_msg)
    
    # 0b. Check for strict morning lab mode capacity issues
    # Check if strict mode is too restrictive - CHECK PER SECTION, NOT PER BATCH
    section_theory_needs = defaultdict(int)
    section_strict_config = {}
    
    for ti, task in enumerate(tasks):
        # Check each section independently
        for section_id in task["section_ids"]:
            if section_id in section_map:
                section = section_map[section_id]
                batch = section.batch
                section_key = f"{section.display_name}"
                
                # Add theory credits for THIS section only
                section_theory_needs[section_key] += task["theory_credits"]
                
                # Store section's batch config
                if section_key not in section_strict_config and batch.morning_lab_mode == "strict":
                    section_strict_config[section_key] = {
                        "batch_id": batch.id,
                        "days": batch.morning_lab_days or [],
                        "count": batch.morning_lab_count
                    }
    
    # Check if strict mode makes scheduling impossible FOR EACH SECTION
    strict_mode_issues = []
    for section_key, theory_needed in section_theory_needs.items():
        if section_key in section_strict_config:
            config = section_strict_config[section_key]
            strict_days = config["days"]
            
            # Calculate available theory slots with strict mode
            # Strict mode: theory only in slots 4-7 (4 slots) on strict days
            # Normal days: all 8 slots available (but minus break = 7 slots)
            strict_day_count = len(strict_days)
            normal_day_count = 5 - strict_day_count
            
            # Slots available: (strict_days × 4) + (normal_days × 7)
            available_theory_slots = (strict_day_count * 4) + (normal_day_count * 7)
            
            if theory_needed > available_theory_slots:
                strict_mode_issues.append(
                    f"• Section {section_key}: needs {theory_needed} theory slots but only {available_theory_slots} available\n"
                    f"  Strict morning lab mode on {strict_day_count} days limits theory to afternoon slots (4-7)\n"
                    f"  This reduces capacity from 35 to {available_theory_slots} theory slots"
                )
    
    if strict_mode_issues:
        error_msg = (
            "⚠️  STRICT MORNING LAB MODE TOO RESTRICTIVE\n\n"
            "The following sections cannot fit their theory classes due to strict morning lab mode:\n\n"
            + "\n".join(strict_mode_issues) +
            "\n\nSTRICT MODE restricts theory classes to afternoon slots (4-7) on configured days,\n"
            "which significantly reduces available capacity.\n\n"
            "SOLUTION (choose one):\n"
            "  1. Go to Batch Settings page\n"
            "  2. Change morning lab mode from 'strict' to 'prefer' or 'count'\n"
            "  3. Or reduce the number of days with strict mode\n"
            "  4. Or disable morning lab mode entirely for this batch\n\n"
            "NOTE: 'prefer' mode encourages morning labs but allows flexibility when needed."
        )
        print(f"[SOLVER PRE-VALIDATION FAILED]\n{error_msg}")
        raise ValueError(error_msg)
    
    # 1. Check each task has enough variable slots
    for ti, task in enumerate(tasks):
        tv_count = len(vars_by_task[ti])
        lv_count = len(lab_vars_by_task[ti])
        needed_th = task["theory_credits"]
        needed_lab = task["lab_credits"]
        
        task_info = {
            "index": ti,
            "subject_code": task['subject'].code,
            "subject_name": task['subject'].full_name,
            "theory_needed": needed_th,
            "theory_vars": tv_count,
            "lab_needed": needed_lab,
            "lab_vars": lv_count,
            "teacher": teacher_map.get(task["teacher_id"]).name if task.get("teacher_id") else None,
            "lab_engineer": teacher_map.get(task["lab_engineer_id"]).name if task.get("lab_engineer_id") else None,
            "sections": [section_map[sid].display_name for sid in task["section_ids"] if sid in section_map]
        }
        
        # Flag potential issues
        if needed_th > 0 and tv_count < needed_th:
            issue = f"Insufficient theory slots: need {needed_th}, have {tv_count} available"
            task_info["issue"] = issue
            teacher_name = task_info["teacher"] or "Unknown"
            sec_names = ", ".join(task_info["sections"])
            pre_validation_errors.append(
                f"• {task['subject'].code} ({sec_names}): needs {needed_th} theory slots but only {tv_count} available. "
                f"Teacher '{teacher_name}' has too many restrictions."
            )
        if needed_lab > 0 and lv_count < 1:
            issue = f"No possible lab positions available"
            task_info["issue"] = issue
            le_name = task_info["lab_engineer"] or task_info["teacher"] or "Unknown"
            sec_names = ", ".join(task_info["sections"])
            pre_validation_errors.append(
                f"• {task['subject'].code} Lab ({sec_names}): no valid lab positions. "
                f"Lab Engineer '{le_name}' may have too many restrictions."
            )
        
        diagnostics["tasks_detail"].append(task_info)
        print(f"  Task {ti} ({task['subject'].code}): need {needed_th} theory (have {tv_count} vars), need {needed_lab} lab (have {lv_count} vars)")
    
    # 2. Check teacher total load vs available slots
    # IMPORTANT: Labs are taught by lab engineers, NOT by theory teachers.
    # Only count theory hours for the teacher, and lab hours for the lab engineer separately.
    teacher_load = defaultdict(lambda: {"theory": 0, "lab_blocks": 0, "sections": set(), "subjects": []})
    for ti, task in enumerate(tasks):
        tid = task.get("teacher_id")
        le_id = task.get("lab_engineer_id")
        
        if tid:
            for sid in task["section_ids"]:
                teacher_load[tid]["sections"].add(section_map[sid].display_name if sid in section_map else str(sid))
            # Only count THEORY hours for the teacher
            teacher_load[tid]["theory"] += task["theory_credits"] * len(task["section_ids"])
            teacher_load[tid]["subjects"].append(task["subject"].code)
        
        if le_id and task["lab_credits"] > 0:
            for sid in task["section_ids"]:
                teacher_load[le_id]["sections"].add(section_map[sid].display_name if sid in section_map else str(sid))
            # Count LAB hours for the lab engineer
            teacher_load[le_id]["lab_blocks"] += task["lab_credits"] * len(task["section_ids"])
            teacher_load[le_id]["subjects"].append(task["subject"].code + " (Lab)")
    
    for tid, load in teacher_load.items():
        total_needed = load["theory"] + load["lab_blocks"] * 3
        # Count actual free SCHEDULABLE slots (not just total - restrictions)
        # Some restrictions may be on non-schedulable slots (like break slot 2)
        total_available = 0
        for d in DAYS:
            for s in schedulable_slots[d]:
                if (d, s) not in restricted_slots[tid]:
                    total_available += 1
        
        if total_needed > total_available:
            teacher_name = teacher_map.get(tid).name if teacher_map.get(tid) else str(tid)
            deficit = total_needed - total_available
            restriction_count = len(restricted_slots[tid])
            pre_validation_errors.append(
                f"• Teacher '{teacher_name}' is OVERLOADED: needs {total_needed}h total "
                f"({load['theory']}h theory + {load['lab_blocks']} lab blocks) "
                f"but only {total_available}h available ({restriction_count} slots restricted). "
                f"Subjects: {', '.join(set(load['subjects']))}. "
                f"Fix: Remove {deficit} hours of assignments OR reduce {deficit} restrictions."
            )
    
    # If there are pre-validation errors, fail early with actionable message
    if pre_validation_errors:
        error_header = f"Timetable generation failed: INFEASIBLE\n\nThe following issues make it IMPOSSIBLE to generate a valid timetable:\n"
        error_details = "\n".join(pre_validation_errors)
        error_footer = (
            "\n\nTo fix this, please do ONE of the following:"
            "\n  1. Reduce teacher restrictions (Settings > Restrictions)"
            "\n  2. Reassign some subjects to different teachers"
            "\n  3. Remove some assignments from overloaded teachers"
        )
        full_error = error_header + error_details + error_footer
        print(f"[SOLVER PRE-VALIDATION FAILED]\n{full_error}")
        raise ValueError(full_error)
    

    status = solver.Solve(model)
    print(f"[SOLVER] Status: {solver.StatusName(status)}, Time: {solver.WallTime():.2f}s")
    
        # If INFEASIBLE, try to find the EXACT conflicting constraints
    if status == cp_model.INFEASIBLE:
        print("\n[SOLVER] INFEASIBLE - Analyzing conflicts...")
        print("This means the constraints cannot all be satisfied together.")
        
        # Detailed diagnostics for 23BAE
        print("\n=== DETAILED CONSTRAINT ANALYSIS ===")
        for ti, task in enumerate(tasks):
            batch_name = f"{task['batch_year']}{task['dept_code']}"
            subject_code = task['subject'].code
            teacher_id = task.get('teacher_id')
            teacher_name = teacher_map.get(teacher_id).name if teacher_id and teacher_id in teacher_map else "N/A"
            
            # Check theory slots
            theory_vars = [(d, s) for (t, d, s) in x_theory.keys() if t == ti]
            # Check lab slots
            lab_vars = [(d, ls) for (t, d, ls) in x_lab.keys() if t == ti]
            
            # Check teacher restrictions
            restricted = restricted_slots.get(teacher_id, set()) if teacher_id else set()
            
            print(f"\nTask {ti}: {batch_name} - {subject_code}")
            print(f"  Teacher: {teacher_name}")
            print(f"  Theory: {task['theory_credits']}h, Lab: {task['lab_credits']}h")
            print(f"  Theory slot options: {len(theory_vars)}")
            print(f"  Lab slot options: {len(lab_vars)}")
            print(f"  Teacher restricted slots: {len(restricted)}")
            
            if len(restricted) > 25:
                print(f"  ⚠️  WARNING: Teacher has {len(restricted)} restricted slots (out of 32 total)")
        
        print("\nMost common causes:")
        print("  1. Teacher restrictions blocking too many slots")
        print("  2. Lab room availability constraints")
        print("  3. Consecutive lecture requirements")
        print("  4. Friday slot requirements")
        print("\nTry: Check teacher restrictions or relax constraints")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Check if we're adding to an existing timetable (incremental mode)
        if timetable_id:
            tt = db.query(Timetable).filter(Timetable.id == timetable_id).first()
            if not tt:
                raise ValueError(f"Target timetable with ID {timetable_id} not found")
            # Keep existing timetable, just add new slots to it
            print(f"[INCREMENTAL MODE] Adding slots to existing timetable: {tt.name} (ID: {tt.id})")
        else:
            # Create new timetable
            tt = Timetable(
                name=name, status="generated", semester_info=semester_info,
                created_by_id=user_id, department_id=target_dept_id,
                session_id=session_id,
                class_duration=class_duration,
                start_time=start_time or "08:30",
                break_start_time=break_start_time,
                break_end_time=break_end_time,
                max_slots_per_day=max_slots_per_day,
                break_slot=break_slot,
                friday_has_break=friday_has_break
            )
            db.add(tt)
            db.commit()
            db.refresh(tt)

        # Create Slots
        recs = []
        for (ti, d, s), v in x_theory.items():
            if solver.BooleanValue(v):
                task = tasks[ti]
                for sid in task["section_ids"]:
                    recs.append(TimetableSlot(
                        timetable_id=tt.id, day=d, slot_index=s,
                        section_id=sid, subject_id=task["subject"].id,
                        teacher_id=task["teacher_id"], room_id=task["room_id"],
                        is_lab=False
                    ))

        for (ti, d, ls), v in x_lab.items():
            if solver.BooleanValue(v):
                task = tasks[ti]
                # Use lab_room_id for lab sessions, fallback to regular room_id if not set
                lab_room = task.get("lab_room_id") or task["room_id"]
                for offset in range(3):
                    for sid in task["section_ids"]:
                        recs.append(TimetableSlot(
                            timetable_id=tt.id, day=d, slot_index=ls + offset,
                            section_id=sid, subject_id=task["subject"].id,
                            teacher_id=task["teacher_id"], room_id=lab_room,
                            is_lab=True, lab_engineer_id=task["lab_engineer_id"]
                        ))
        
        # Breaks & FYP
        # DYNAMIC BREAK: For each section on each Mon-Thu day, the break slot
        # is determined by whether a morning lab (start=0, occupies slots 0,1,2)
        # was scheduled. If it was, the break is at slot 3 (11:00). Otherwise, slot 2 (10:30).
        # Build lookup: set of (ti, d) that have a morning lab scheduled
        morning_labs_scheduled = set()
        for (ti, d, ls), v in x_lab.items():
            if ls == 0 and solver.BooleanValue(v):
                morning_labs_scheduled.add((ti, d))

        # Build lookup of all lab-occupied slots per section per day (to avoid break collision)
        section_lab_slots = defaultdict(set)  # (sid, d) -> set of slot indices occupied by labs
        for (ti, d, ls), v in x_lab.items():
            if solver.BooleanValue(v):
                task = tasks[ti]
                for offset in range(3):
                    for sid in task["section_ids"]:
                        section_lab_slots[(sid, d)].add(ls + offset)

        for d in DAYS:
            for sid in section_map.keys():
                sec = section_map[sid]
                if batch_ids and sec.batch_id not in batch_ids:
                    continue
                if d == 4 and not friday_has_break:
                    continue

                if d < 4:  # Mon-Thu: dynamic break
                    # Check if this section has a morning lab on this day
                    section_has_morning_lab = any(
                        (ti, d) in morning_labs_scheduled
                        for ti, task in enumerate(tasks)
                        if sid in task["section_ids"]
                    )
                    
                    # Check if this day is a configured morning lab day for this batch
                    # For STRICT mode: break at slot 3 on ALL configured days (for consistency)
                    # For PREFER mode: break at slot 3 ONLY if lab actually scheduled
                    batch_id = sec.batch_id
                    batch_config = batch_morning_lab_config.get(batch_id)
                    is_strict_morning_day = False
                    
                    if batch_config and batch_config.get("mode") == "strict":
                        config_days = batch_config.get("days", [])
                        # If this day is in the configured morning lab days
                        # Reserve morning slots on ALL configured days for consistency
                        # Even if fewer labs than days (e.g., 3 labs on 4 days = 1 empty morning)
                        is_strict_morning_day = not config_days or d in config_days
                    
                    # Break at slot 3 if:
                    # (1) Morning lab actually scheduled, OR
                    # (2) Strict mode configured day (reserves slots for consistency)
                    actual_break_slot = 3 if (section_has_morning_lab or is_strict_morning_day) else break_slot
                else:
                    actual_break_slot = break_slot

                # Skip writing break if a lab already occupies that slot
                # (e.g. afternoon lab starts at slot 3 when morning lab already shifted break)
                if actual_break_slot in section_lab_slots.get((sid, d), set()):
                    continue

                recs.append(TimetableSlot(
                    timetable_id=tt.id, day=d, slot_index=actual_break_slot,
                    section_id=sid, is_break=True, label="Break"
                ))
        
        for sid, locks in section_locks.items():
            for lock_info in locks:
                lock_day = lock_info["day"]
                lock_label = lock_info["label"]
                t = lock_info["task"]
                start_slot = lock_info.get("start_slot", 0)
                consecutive_slots = lock_info.get("consecutive_slots", 5)
                
                # Use the configured start_slot and consecutive_slots from the rule
                # Generate slots from start_slot to start_slot + consecutive_slots
                target_slots = list(range(start_slot, start_slot + consecutive_slots))
                
                for s in target_slots:
                    recs.append(TimetableSlot(
                        timetable_id=tt.id, day=lock_day, slot_index=s,
                        section_id=sid, label=lock_label,
                        subject_id=t["subject"].id if t else None,
                        teacher_id=t["teacher_id"] if t else None,
                        room_id=t["room_id"] if t else None,
                        is_lab=False,
                        lab_engineer_id=t["lab_engineer_id"] if t else None
                    ))

        db.bulk_save_objects(recs)
        db.commit()
        
        # Print success summary
        print(f"\n[SOLVER SUCCESS] Generated timetable '{name}' (ID: {tt.id})")
        print(f"  Total slots created: {len(recs)}")
        print(f"  Theory slots: {sum(1 for r in recs if not r.is_lab and not r.is_break and not r.label)}")
        print(f"  Lab slots: {sum(1 for r in recs if r.is_lab)}")
        print(f"  Break slots: {sum(1 for r in recs if r.is_break)}")
        print(f"  Special slots (FYP, etc.): {sum(1 for r in recs if r.label and not r.is_break)}")
        
        return tt
    else:
        # DO NOT store infeasible timetables
        # Build detailed diagnostic report
        import json
        
        issues = []
        issues.append("The constraints provided to the solver are conflicting and cannot be met.\n")
        
        # ── TEACHER CONFLICT REPORTING ──────────────────────────────
        # Show detected teacher conflicts first (most actionable)
        if teacher_conflicts:
            issues.append("⚠️  TEACHER CONFLICTS DETECTED:")
            issues.append("The following teachers have conflicting assignments that cannot be scheduled:\n")
            
            for conflict in teacher_conflicts:
                teacher_name = conflict["teacher"]
                total_hours = conflict["total_hours"]
                available = conflict["available_slots"]
                conflict_type = conflict.get("conflict_type", "")
                
                if conflict_type:
                    issues.append(f"  • {teacher_name} - {conflict_type}")
                else:
                    issues.append(f"  • {teacher_name} - Requires {total_hours} hours but only {available} slots available")
                
                for asg in conflict["assignments"]:
                    sections_str = ", ".join(asg["sections"])
                    issues.append(f"    - {asg['subject']} ({asg['role']}, {asg['hours']}h) for {sections_str}")
                
                issues.append("")  # Blank line between teachers
            
            issues.append("ACTION REQUIRED:")
            issues.append("  1. Go to Assignments page")
            issues.append("  2. Find the conflicting assignments listed above")
            issues.append("  3. Change the teacher or lab engineer to someone else")
            issues.append("  4. Or remove one of the conflicting assignments")
            issues.append("")
        
        problem_tasks = [t for t in diagnostics["tasks_detail"] if "issue" in t]
        
        if problem_tasks:
            issues.append("INSUFFICIENT SLOTS FOR:")
            for t in problem_tasks:
                issues.append(f"  • {t['subject_code']} ({t['subject_name']}) - {t['issue']}")
                issues.append(f"    Teacher: {t['teacher']}, Sections: {', '.join(t['sections'])}")
        
        # Re-check workload vs capacity mathematically to provide deeper insights
        issues.append("\nADDITIONAL DIAGNOSTICS:")
        
        # Group tasks by (batch_year, dept_code, subject) to avoid counting sections multiple times
        # Sections of the same subject are scheduled at the SAME TIME
        total_slots_needed_by_batch = defaultdict(int)
        seen_batch_subjects = set()
        
        for t in tasks:
            batch_year = t["batch_year"]
            dept_code = t["dept_code"]
            subject_id = t["subject"].id
            key = (batch_year, dept_code, subject_id)
            
            # Only count each subject once per batch-department combination (not per section)
            if key not in seen_batch_subjects:
                seen_batch_subjects.add(key)
                needed = t["theory_credits"] + (t["lab_credits"] * 3)
                batch_key = f"{batch_year}{dept_code}"
                total_slots_needed_by_batch[batch_key] += needed
            
        # Calculate total available slots INCLUDING break slots (breaks are scheduled, not missing)
        total_slots_available = 0
        for d in range(4):  # Mon-Thu
            total_slots_available += (max_slots_per_day or 8)
        total_slots_available += max_slots_friday  # Friday
            
        for batch_key, needed in sorted(total_slots_needed_by_batch.items()):
            issues.append(f"  • Batch {batch_key} requires {needed} total slots. Capacity is {total_slots_available} slots/week.")
            if needed > total_slots_available:
                issues.append(f"    *** ERROR: Batch requires more slots than physically available! ***")
        
        # General suggestions (only if no teacher conflicts detected)
        if not teacher_conflicts:
            issues.append("\nSUGGESTIONS:")
            issues.append("  1. Check teacher restrictions (teachers may end up with 0 available slots)")
            issues.append("  2. Verify room availability and capacity limitations")
            issues.append("  3. Review lab timing requirements (morning vs afternoon blocks)")
            issues.append("  4. Check for conflicting assignments across other active/generated timetables")
            issues.append("  5. Try generation on individual batches to isolate the problematic batch")
        
        error_msg = f"Timetable generation failed (Status: {solver.StatusName(status)})\n\n" + "\n".join(issues)
        print(f"\n[SOLVER ERROR]\n{error_msg}")
        
        raise ValueError(error_msg)


def generate_timetable_sequential(db: Session, name: str = "Sequential Generated",
                                   semester_info: str = None, user_id: int = None,
                                   target_dept_id: int = None,
                                   batch_ids_ordered: List[int] = None,
                                   **kwargs) -> Timetable:
    """
    Sequential batch-wise timetable generation.
    
    Processes batches one by one in the specified order:
    1. Generate timetable for batch 1
    2. Commit results to database
    3. Generate timetable for batch 2 (respecting batch 1's slots as constraints)
    4. Commit results
    5. Continue for all batches
    
    This approach reduces solver complexity by breaking the problem into smaller chunks,
    making it easier to find solutions when generating all batches together fails.
    
    Args:
        db: Database session
        name: Base name for the timetable (will be suffixed with batch info)
        batch_ids_ordered: List of batch IDs in the order they should be processed
        **kwargs: All other parameters passed to generate_timetable()
    
    Returns:
        The final Timetable object containing all batches
    """
    if not batch_ids_ordered or len(batch_ids_ordered) == 0:
        raise ValueError("Sequential mode requires at least one batch ID")
    
    print(f"\n[SEQUENTIAL GENERATION] Starting sequential generation for {len(batch_ids_ordered)} batches")
    print(f"[SEQUENTIAL GENERATION] Order: {batch_ids_ordered}")
    
    # Create the main timetable object that will hold all batches
    main_timetable = None
    
    # Process each batch sequentially
    for idx, batch_id in enumerate(batch_ids_ordered, 1):
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        batch_name = batch.display_name if batch else f"Batch {batch_id}"
        
        print(f"\n[SEQUENTIAL GENERATION] Step {idx}/{len(batch_ids_ordered)}: Processing {batch_name}")
        
        try:
            # Generate timetable for this single batch
            # If this is the first batch, create a new timetable
            # Otherwise, add to the existing timetable
            if idx == 1:
                # First batch: create new timetable
                batch_tt = generate_timetable(
                    db=db,
                    name=f"{name} - {batch_name}",
                    semester_info=semester_info,
                    user_id=user_id,
                    target_dept_id=target_dept_id,
                    batch_ids=[batch_id],  # Only this batch
                    **kwargs
                )
                main_timetable = batch_tt
                print(f"[SEQUENTIAL GENERATION] ✓ Created timetable for {batch_name} (ID: {batch_tt.id})")
            else:
                # Subsequent batches: add to existing timetable
                # The existing slots will automatically act as constraints via the
                # existing_slots mechanism in generate_timetable
                batch_tt = generate_timetable(
                    db=db,
                    name=f"{name} - {batch_name}",
                    semester_info=semester_info,
                    user_id=user_id,
                    target_dept_id=target_dept_id,
                    batch_ids=[batch_id],  # Only this batch
                    timetable_id=main_timetable.id,  # Add to existing timetable
                    **kwargs
                )
                print(f"[SEQUENTIAL GENERATION] ✓ Added {batch_name} to timetable (ID: {main_timetable.id})")
            
            # Commit after each batch to ensure slots are saved
            db.commit()
            
        except ValueError as e:
            error_msg = f"Sequential generation failed at batch {batch_name} (step {idx}/{len(batch_ids_ordered)})\n\n{str(e)}"
            print(f"[SEQUENTIAL GENERATION] ✗ Failed at {batch_name}: {str(e)}")
            
            # If we have a partial timetable, mark it as failed
            if main_timetable:
                main_timetable.status = "failed"
                main_timetable.name = f"{name} - FAILED at {batch_name}"
                db.commit()
            
            raise ValueError(error_msg)
    
    # Update the final timetable name to reflect all batches
    if main_timetable:
        main_timetable.name = name
        db.commit()
        db.refresh(main_timetable)
        
        slot_count = db.query(TimetableSlot).filter(TimetableSlot.timetable_id == main_timetable.id).count()
        print(f"\n[SEQUENTIAL GENERATION] ✓ Successfully completed all {len(batch_ids_ordered)} batches")
        print(f"[SEQUENTIAL GENERATION] Total slots generated: {slot_count}")
    
    return main_timetable
