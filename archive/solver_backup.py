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
SLOTS_MON_THU = [0, 1, 3, 4, 5, 6, 7]  # slot 2 is break
SLOTS_FRI = [0, 1, 2, 3, 4]            # no break, 5 slots

# Lab-eligible starting positions (need 3 contiguous slots)
# Mon-Thu: can start at 3,4,5 (slots 3-4-5, 4-5-6, 5-6-7)
#          also 0-1 are before break so only 0,1 → can't get 3 contiguous before break
LAB_STARTS_MON_THU = [3, 4, 5]  # yields blocks [3,4,5], [4,5,6], [5,6,7]
LAB_STARTS_FRI = [0, 1, 2]      # yields blocks [0,1,2], [1,2,3], [2,3,4]

# New: Lab Morning starts
LAB_STARTS_MORNING = [0] # Morning labs start at 0 (0-1-2)

BREAK_SLOT = 2  # on Mon-Thu only


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
                       break_slot: int = None,
                       break_start_time: str = None,
                       break_end_time: str = None,
                       max_slots_per_day: int = None,
                       max_slots_friday: int = None,
                       lab_start_morning: bool = False,
                       friday_has_break: bool = False,
                       allow_friday_labs: bool = False,
                       prefer_early_dismissal: bool = False,
                       session_id: int = None,
                       batch_ids: List[int] = None) -> Timetable:
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
    # Mon-Thu: 0-7, slot 2 is break
    # Friday: 0 to max_slots_friday - 1
    schedulable_slots = {}
    for d in range(4):
        schedulable_slots[d] = [i for i in range(max_slots_per_day or 8) if i != break_slot]
    
    if friday_has_break:
        schedulable_slots[4] = [i for i in range(max_slots_friday) if i != break_slot]
    else:
        schedulable_slots[4] = list(range(max_slots_friday))

    # Lab possible starts
    lab_starts = {}
    for d in range(4):
        valid = []
        for s in range((max_slots_per_day or 8) - 2):
            if break_slot not in [s, s+1, s+2]:
                valid.append(s)
        lab_starts[d] = valid
    
    # Friday lab starts
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
    elif target_dept_id:
        # Fallback to department if no session provided (for backward compatibility or super admin)
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
                
                # Check if strict lab timing applies to this task
                # IMPORTANT: Strict mode only applies when lab_start_morning is enabled
                strict_lab_timing = False
                preferred_start_slot = None
                if lab_start_morning:
                    for lr in lab_rules:
                        if (not lr.get("dept") or task["dept_code"] == lr["dept"]) and \
                           (not lr.get("batch") or task["batch_year"] == lr["batch"]):
                            strict_lab_timing = lr.get("strict_mode", False)
                            preferred_start_slot = lr.get("preferred_start_slot")
                            break
                
                # Calculate minimum theory slot based on strict lab timing
                # If strict mode: lab takes 3 slots starting at preferred_start_slot, then break, then theory
                min_theory_slot = 0
                if strict_lab_timing and preferred_start_slot is not None and task["lab_credits"] > 0:
                    # Lab ends at preferred_start_slot + 3
                    # Break is 1 slot after lab
                    # Theory starts after break
                    min_theory_slot = preferred_start_slot + 4  # 3 lab slots + 1 break slot
                    
                for s in schedulable_slots[d]:
                    # Skip slots before minimum theory slot if strict mode is enabled
                    if strict_lab_timing and s < min_theory_slot:
                        continue
                        
                    if comb_id:
                        if not comb_free_slots[comb_id, d, s]: continue
                    else:
                        if (d, s) in restricted_slots[task["teacher_id"]]: continue
                        
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

                    x_theory[ti, d, s] = v
                    vars_by_task[ti].append(v)
                    vars_by_task_day[ti][d][s] = v
                    
                    if task["teacher_id"]:
                        teacher_vars_at[d][s][task["teacher_id"]].append(v)
                    for sid in task["section_ids"]:
                        section_vars_at[d][s][sid].append(v)
                    if task["room_id"]:
                        room_vars_at[d][s][task["room_id"]].append(v)

        # Lab variables
        if task["lab_credits"] > 0:
            for d in DAYS:
                # GENERALIZED RULE: No regular subject labs on Friday (unless allow_friday_labs is enabled)
                # (FYP and other special projects are handled separately via FYP rules)
                if d == 4 and not allow_friday_labs:
                    continue
                
                # ── Determine if morning is preferred for this specific batch/dept ──
                # Default is based on section config or global argument
                lab_morning_pref = (d in task["lab_morning_days"]) or lab_start_morning
                
                # Check Global Lab Rules for overrides
                # IMPORTANT: Strict mode only applies when lab_start_morning is enabled
                preferred_start_slot = None
                strict_lab_timing = False
                for lr in lab_rules:
                    if (not lr.get("dept") or task["dept_code"] == lr["dept"]) and \
                       (not lr.get("batch") or task["batch_year"] == lr["batch"]):
                        # If a rule matches, it defines the morning days for this batch
                        lab_morning_pref = d in lr.get("morning_days", [])
                        # Strict mode only activates if lab_start_morning is checked
                        if lab_start_morning:
                            preferred_start_slot = lr.get("preferred_start_slot")
                            strict_lab_timing = lr.get("strict_mode", False)
                        break
                
                is_morning_day = lab_morning_pref
                
                # If strict mode is enabled, only allow the preferred start slot
                if strict_lab_timing and preferred_start_slot is not None:
                    allowed_lab_starts = [preferred_start_slot] if preferred_start_slot in lab_starts[d] else []
                else:
                    allowed_lab_starts = lab_starts[d]
                
                # Debug logging for RPC specifically
                if task["subject"].code == "RPC":
                    print(f"[DEBUG RPC] Day {d}, allowed_lab_starts: {allowed_lab_starts}")
                    if task["lab_engineer_id"]:
                        le_name = teacher_map.get(task["lab_engineer_id"]).name if teacher_map.get(task["lab_engineer_id"]) else "Unknown"
                        print(f"[DEBUG RPC] Lab Engineer: {le_name} (ID: {task['lab_engineer_id']})")
                        print(f"[DEBUG RPC] Lab Engineer restrictions: {[s for s in restricted_slots[task['lab_engineer_id']]]}")
                
                for ls in allowed_lab_starts:
                    if comb_id:
                        if not comb_free_lab_starts[comb_id, d, ls]: continue
                    else:
                        conflict = False
                        conflict_reason = ""
                        for offset in range(3):
                            slot = ls + offset
                            # Only check LAB ENGINEER restrictions for lab slots, not theory teacher
                            if task["lab_engineer_id"] and (d, slot) in restricted_slots[task["lab_engineer_id"]]:
                                conflict = True
                                conflict_reason = f"Lab Engineer restricted at day {d}, slot {slot}"
                                break
                        
                        # Debug logging for RPC
                        if task["subject"].code == "RPC":
                            if conflict:
                                print(f"[DEBUG RPC] Day {d}, start slot {ls}: BLOCKED - {conflict_reason}")
                            else:
                                print(f"[DEBUG RPC] Day {d}, start slot {ls}: AVAILABLE (slots {ls},{ls+1},{ls+2})")
                        
                        if conflict: continue
                        
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

                    x_lab[ti, d, ls] = v
                    lab_vars_by_task[ti].append(v)
                    
                    for offset in range(3):
                        s = ls + offset
                        if task["teacher_id"]:
                            teacher_vars_at[d][s][task["teacher_id"]].append(v)
                        if task["lab_engineer_id"]:
                            teacher_vars_at[d][s][task["lab_engineer_id"]].append(v)
                        for sid in task["section_ids"]:
                            section_vars_at[d][s][sid].append(v)
                        if task["room_id"]:
                            room_vars_at[d][s][task["room_id"]].append(v)

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

            # Different days: at most 1 theory slot per day
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
            
            # Soft Convexity (No-Gaps): If s1 and s3 are occupied, we strongly prefer s2 to be occupied
            if len(slots) > 2:
                for i in range(len(slots)):
                    for j in range(i + 2, len(slots)):
                        s1, s2_list, s3 = slots[i], slots[i+1:j], slots[j]
                        if s1 in occupied and s3 in occupied:
                            for s2 in s2_list:
                                if s2 in occupied:
                                    # gap = Bool(s1 & s3 & !s2)
                                    # gap >= s1 + s3 - s2 - 1
                                    gap_v = model.NewBoolVar(f"gap_{sec_id}_{d}_{s1}_{s2}_{s3}")
                                    model.Add(gap_v >= occupied[s1] + occupied[s3] - occupied[s2] - 1)
                                    penalties.append(gap_v * gap_penalty) # High penalty for gaps

            # New: Daily Load Balancing for Section
            # Penalize days that are heavily loaded to encourage spreading classes.
            if occupied:
                daily_load = model.NewIntVar(0, len(slots), f"load_{sec_id}_{d}")
                model.Add(daily_load == sum(occupied.values()))
                
                # Friday constraint: allow UP TO max_slots_friday slots (soft, not forced)
                if d == 4 and sec_id not in section_locks:
                    # Allow at most max_slots_friday on Friday (don't force it full)
                    model.Add(daily_load <= max_slots_friday)
                
                # A simple soft penalty: the penalty increases with the load.
                overload = model.NewIntVar(0, len(slots), f"overload_{sec_id}_{d}")
                model.AddMaxEquality(overload, [0, daily_load - 3])
                penalties.append(overload * 5000) # Penalize having more than 3 classes a day heavily
                
                # And a small general penalty for every class on a day to slightly spread them
                penalties.append(daily_load * 500)
                
                # SOFT: Penalize empty Mon-Thu days — use ALL weekdays, don't leave any empty
                if d < 4:  # Mon-Thu only
                    empty_day = model.NewBoolVar(f"empty_{sec_id}_{d}")
                    model.Add(daily_load == 0).OnlyEnforceIf(empty_day)
                    model.Add(daily_load > 0).OnlyEnforceIf(empty_day.Not())
                    penalties.append(empty_day * 80000)  # Very strong penalty for empty weekday

            # New: Compact Morning (Hard Constraint)
            # If enabled, classes MUST start from slot 0 and be continuous.
            if compact_morning:
                for i in range(1, len(slots)):
                    curr, prev = slots[i], slots[i-1]
                    if curr in occupied and prev in occupied:
                        # occupied[curr] must be <= occupied[prev]
                        # This means you can't have a class in a later slot if the previous one is empty.
                        model.Add(occupied[curr] <= occupied[prev])

            # Theory-to-Lab Transition: Theory MUST finish before Lab starts
            # AND since we have a global No Gap, Labs will naturally start right after Theory
            labs_here = []
            for ti in t_indices:
                if ti in lab_vars_by_task:
                    for (t_i, dd, ls) in x_lab:
                        if t_i == ti and dd == d:
                            labs_here.append((ti, ls))
            
            for ti_lab, ls in labs_here:
                for ti_th in t_indices:
                    if ti_th in vars_by_task_day and d in vars_by_task_day[ti_th]:
                        th_slots_on_day = vars_by_task_day[ti_th][d]
                        for s, th_var in th_slots_on_day.items():
                            # If theory is at or after lab start, they cannot both be true
                            if s >= ls:
                                model.Add(th_var + x_lab[ti_lab, d, ls] <= 1)
                

    # Teacher workload constraint REMOVED - solver should ignore teacher max hours
    # Workload is tracked for display purposes only, not enforced during generation

    # ── Early Dismissal Optimization (Mon-Thu only) ────────────────
    if prefer_early_dismissal:
        # NEW APPROACH: Minimize the latest occupied slot per section per day
        # This ensures we pack classes earlier and students can leave sooner
        
        for sec_id, t_indices in section_tasks.items():
            for d in range(4):  # Mon-Thu only (0-3)
                slots = schedulable_slots[d]
                if not slots:
                    continue
                
                # Track which slots are occupied by this section on day d
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
                
                # Create boolean variables for each slot being occupied
                occupied = {}
                for s in slots:
                    if slot_occupied_vars[s]:
                        occ_v = model.NewBoolVar(f"early_occ_{sec_id}_{d}_{s}")
                        model.AddMaxEquality(occ_v, slot_occupied_vars[s])
                        occupied[s] = occ_v
                
                if not occupied:
                    continue
                
                # Create a variable for the latest occupied slot
                # Penalize heavily based on how late the last class ends
                # Penalty structure: exponential growth for later slots
                for s in slots:
                    if s in occupied:
                        # Check if this is the latest slot by seeing if any later slots are occupied
                        later_slots = [slot for slot in slots if slot > s and slot in occupied]
                        
                        if not later_slots:
                            # This could be the last slot - penalize it heavily
                            # Penalty increases exponentially: slot 3=10, 4=50, 5=200, 6=500, 7=1000
                            slot_penalty = {
                                0: 0, 1: 0,      # Morning - no penalty
                                3: 10, 4: 50,    # Early afternoon - small penalty  
                                5: 200,          # Mid afternoon - medium penalty
                                6: 500,          # Late afternoon - high penalty
                                7: 1000          # Very late - very high penalty
                            }
                            penalty = slot_penalty.get(s, 0)
                            if penalty > 0:
                                penalties.append(occupied[s] * penalty)
                        else:
                            # Not the last slot, but still penalize occupation of late slots
                            # to encourage moving classes to earlier days/slots
                            if s >= 5:  # Only penalize slots 5, 6, 7
                                penalties.append(occupied[s] * (s * 10))

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
        print("Most common causes:")
        print("  1. Friday constraint: Forcing exactly 3 classes on Friday for all sections")
        print("  2. Teacher restrictions blocking too many slots")
        print("  3. Room conflicts")
        print("  4. Section conflicts (same section, multiple classes at same time)")
        print("\nTry: Reduce Friday slots requirement or check teacher restrictions")

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        tt = Timetable(
            name=name, status="generated", semester_info=semester_info,
            created_by_id=user_id, department_id=target_dept_id,
            session_id=session_id,
            class_duration=class_duration,
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
        for d in DAYS:
            for sid in section_map.keys():
                # Check if this section is in the target batches
                sec = section_map[sid]
                if batch_ids and sec.batch_id not in batch_ids:
                    continue
                if d == 4 and not friday_has_break:
                    continue
                recs.append(TimetableSlot(
                    timetable_id=tt.id, day=d, slot_index=break_slot,
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
        problem_tasks = [t for t in diagnostics["tasks_detail"] if "issue" in t]
        
        if problem_tasks:
            issues.append("INSUFFICIENT SLOTS FOR:")
            for t in problem_tasks:
                issues.append(f"  • {t['subject_code']} ({t['subject_name']}) - {t['issue']}")
                issues.append(f"    Teacher: {t['teacher']}, Sections: {', '.join(t['sections'])}")
        
        # REMOVED: Teacher overload check - workload is not enforced by solver
        
        # General suggestions
        issues.append("\nSUGGESTIONS:")
        issues.append("  1. Check teacher restrictions (unavailable days/slots)")
        issues.append("  2. Verify room availability and capacity")
        issues.append("  3. Review lab timing requirements (morning/afternoon)")
        issues.append("  4. Check for conflicting assignments across departments")
        issues.append("  5. Try selecting fewer batches or adjusting Friday slot requirements")
        
        error_msg = f"Timetable generation failed: {solver.StatusName(status)}\n\n" + "\n".join(issues)
        print(f"[SOLVER ERROR]\n{error_msg}")
        
        raise ValueError(error_msg)
