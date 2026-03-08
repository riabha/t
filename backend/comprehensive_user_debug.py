#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import get_db
from models import User, Teacher, Assignment, TimetableSlot, Timetable
from routers.assignments import list_assignments
from routers.timetable import my_schedule
from routers.auth import login
from schemas import LoginRequest

def comprehensive_user_debug():
    db = next(get_db())
    
    # Test multiple users to see the pattern
    test_users = ['muneeb', 'jawad', 'aamir', 'riaz']
    
    print(f"=== COMPREHENSIVE USER DEBUG ===")
    
    for username in test_users:
        print(f"\n{'='*60}")
        print(f"TESTING USER: {username}")
        print(f"{'='*60}")
        
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"❌ User {username} not found")
            continue
        
        print(f"✅ User found: {user.full_name}")
        print(f"   User ID: {user.id}")
        print(f"   Teacher ID: {user.teacher_id}")
        print(f"   Department ID: {user.department_id}")
        print(f"   Role: {user.role}")
        
        # Test login endpoint (what frontend gets)
        print(f"\n--- LOGIN ENDPOINT TEST ---")
        try:
            login_req = LoginRequest(username=username, password=username)
            login_result = login(login_req, db)
            print(f"✅ Login successful")
            print(f"   teacher_id in response: {login_result.get('teacher_id')}")
            print(f"   role: {login_result.get('role')}")
            print(f"   department_id: {login_result.get('department_id')}")
        except Exception as e:
            print(f"❌ Login failed: {e}")
            continue
        
        if not user.teacher_id:
            print(f"❌ User has no teacher_id - skipping API tests")
            continue
        
        # Test assignments API
        print(f"\n--- ASSIGNMENTS API TEST ---")
        try:
            assignments = list_assignments(teacher_id=user.teacher_id, db=db, user=user)
            print(f"✅ Assignments API: {len(assignments)} assignments")
            
            theory_count = sum(1 for a in assignments if a.teacher_id == user.teacher_id)
            lab_count = sum(1 for a in assignments if a.lab_engineer_id == user.teacher_id)
            
            print(f"   Theory assignments: {theory_count}")
            print(f"   Lab assignments: {lab_count}")
            
            # Show departments
            departments = set()
            for a in assignments:
                if a.department_name:
                    departments.add(a.department_name)
            print(f"   Departments: {', '.join(departments)}")
            
        except Exception as e:
            print(f"❌ Assignments API failed: {e}")
        
        # Test timetable APIs
        print(f"\n--- TIMETABLE API TEST ---")
        timetables = db.query(Timetable).filter(Timetable.status != 'archived').all()
        total_slots = 0
        
        for tt in timetables:
            try:
                result = my_schedule(tt_id=tt.id, db=db, user=user)
                slots = result['slots']
                if slots:
                    print(f"   Timetable {tt.id} ({tt.name}): {len(slots)} slots")
                    total_slots += len(slots)
            except Exception as e:
                print(f"   Timetable {tt.id}: Error - {e}")
        
        print(f"   Total timetable slots: {total_slots}")
        
        # Summary
        print(f"\n--- SUMMARY FOR {username.upper()} ---")
        if user.teacher_id:
            print(f"✅ Has teacher profile")
            print(f"✅ Login returns teacher_id: {login_result.get('teacher_id') if 'login_result' in locals() else 'Unknown'}")
            print(f"✅ Assignments: {len(assignments) if 'assignments' in locals() else 'Unknown'}")
            print(f"✅ Timetable slots: {total_slots}")
            
            if 'assignments' in locals() and len(assignments) > 0:
                print(f"✅ Should see data in MyAssignmentsPage")
                if total_slots > 0:
                    print(f"✅ Should see timetable in MySchedulePage")
                else:
                    print(f"⚠️  Should see assignment-based schedule in MySchedulePage")
            else:
                print(f"❌ No assignments - will see empty pages")
        else:
            print(f"❌ No teacher profile - will see 'No Teacher Profile' message")

if __name__ == "__main__":
    comprehensive_user_debug()