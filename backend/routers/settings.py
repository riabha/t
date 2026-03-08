from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import GlobalConfig
from auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class GlobalConfigSchema(BaseModel):
    max_slots_per_day: Optional[int] = 8
    max_slots_friday: Optional[int] = 5
    break_slot: Optional[int] = 3
    break_start_time: Optional[str] = "10:30"
    break_end_time: Optional[str] = "11:00"
    gap_penalty: Optional[int] = 200
    workload_penalty: Optional[int] = 500
    early_slot_penalty: Optional[int] = 50
    lab_priority_multiplier: Optional[int] = 2
    solver_timeout: Optional[int] = 60
    fyp_rules: Optional[List[dict]] = []
    lab_rules: Optional[List[dict]] = []
    compact_morning: Optional[bool] = True
    friday_has_break: Optional[bool] = False
    strict_teacher_restrictions: Optional[bool] = False

    class Config:
        from_attributes = True

def get_or_create_config(db: Session):
    config = db.query(GlobalConfig).first()
    if not config:
        config = GlobalConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.get("/", response_model=GlobalConfigSchema)
def get_settings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Optional: restricts to super_admin or allow program_admin to VIEW?
    # For now, let's allow viewing for awareness, but restrictive PUT.
    return get_or_create_config(db)

@router.put("/", response_model=GlobalConfigSchema)
def update_settings(data: GlobalConfigSchema, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("super_admin", "program_admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    config = get_or_create_config(db)
    
    if user.role == "program_admin":
        from models import Department
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        dept_code = dept.code if dept else None
        if not dept_code:
            raise HTTPException(400, "User has no department")

        # 1. Update primitive fields if provided
        update_data = data.model_dump(exclude_unset=True)
        if "strict_teacher_restrictions" in update_data:
            config.strict_teacher_restrictions = update_data["strict_teacher_restrictions"]
        
        # 2. Merge FYP Rules
        if "fyp_rules" in update_data:
            other_fyp = [r for r in config.fyp_rules if r.get("dept") != dept_code]
            user_fyp = [r for r in data.fyp_rules if r.get("dept") == dept_code]
            config.fyp_rules = other_fyp + user_fyp
        
        # 3. Merge Lab Rules
        if "lab_rules" in update_data:
            other_lab = [r for r in config.lab_rules if r.get("dept") != dept_code]
            user_lab = [r for r in data.lab_rules if r.get("dept") == dept_code]
            config.lab_rules = other_lab + user_lab
        
    else:
        # super_admin can change everything
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    return config
