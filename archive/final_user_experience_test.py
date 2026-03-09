#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import requests
import json
from sqlalchemy.orm import Session
from database import get_db
from models import User, Teacher, Assignment, TimetableSlot, Timetable

def test_complete_user_experience():
    """Test the complete user experience from login to data display"""
    
    base_url = "http://localhost:8000/api"
    
    # Test users with their expected data
    test_cases = [
        {
            "username": "jawad",
            "password": "jawad", 
            "expected": {
                "assignments": 6,
                "theory_assignments": 4,
                "lab_assignments": 2,
                "timetables": 4,
                "schedule_slots": 9,
                "departments": ["Civil Engineering", "Building & Architectural Engineering"]
            }
        },
        {
            "username": "muneeb",
            "password": "muneeb",
            "expected": {
                "assignments": 4,
                "theory_assignments": 4,
                "lab_assignments": 0,
                "timetables": 4,
                "schedule_slots": 14,
                "departments": ["Civil Engineering", "Civil Engineering Technology"]
            }
        },
        {
            "username": "aamir", 
            "password": "aamir",
            "expected": {
                "assignments": 5,
                "theory_assignments": 5,
                "lab_assignments": 0,
                "timetables": 4,
                "schedule_slots": 23,
                "departments": ["Civil Engineering", "Civil Engineering Technology"]
            }
        }
    ]
    
    print("=== COMPLETE USER EXPERIENCE TEST ===")
    print("Testing the full user journey from login to data display\n")
    
    all_passed = True
    
    for test_case in test_cases:
        username = test_case["username"]
        expected = test_case["expected"]
        
        print(f"{'='*60}")
        print(f"TESTING USER: {username.upper()}")
        print(f"{'='*60}")
        
        # Step 1: Login (what frontend does)
        print(f"\n🔐 Step 1: Login Test")
        try:
            login_response = requests.post(f"{base_url}/auth/login", json={
                "username": username,
                "password": test_case["password"]
            })
            
            if login_response.status_code != 200:
                print(f"❌ Login failed: {login_response.status_code}")
                all_passed = False
                continue
                
            login_data = login_response.json()
            teacher_id = login_data.get('teacher_id')
            token = login_data.get('access_token')
            
            if not teacher_id:
                print(f"❌ No teacher_id in login response")
                all_passed = False
                continue
                
            print(f"✅ Login successful - teacher_id: {teacher_id}")
            headers = {"Authorization": f"Bearer {token}"}
            
        except Exception as e:
            print(f"❌ Login error: {e}")
            all_passed = False
            continue
        
        # Step 2: Test MyAssignmentsPage data
        print(f"\n📋 Step 2: My Assignments Page Test")
        try:
            assignments_response = requests.get(
                f"{base_url}/assignments/",
                params={"teacher_id": teacher_id},
                headers=headers
            )
            
            if assignments_response.status_code != 200:
                print(f"❌ Assignments API failed: {assignments_response.status_code}")
                all_passed = False
                continue
                
            assignments = assignments_response.json()
            theory_count = sum(1 for a in assignments if a.get('teacher_id') == teacher_id)
            lab_count = sum(1 for a in assignments if a.get('lab_engineer_id') == teacher_id)
            
            # Check departments
            departments = set()
            for a in assignments:
                if a.get('department_name'):
                    departments.add(a['department_name'])
            
            print(f"   Total assignments: {len(assignments)} (expected: {expected['assignments']})")
            print(f"   Theory assignments: {theory_count} (expected: {expected['theory_assignments']})")
            print(f"   Lab assignments: {lab_count} (expected: {expected['lab_assignments']})")
            print(f"   Departments: {', '.join(sorted(departments))}")
            
            # Verify assignments
            if len(assignments) != expected['assignments']:
                print(f"❌ Assignment count mismatch")
                all_passed = False
            elif theory_count != expected['theory_assignments']:
                print(f"❌ Theory assignment count mismatch")
                all_passed = False
            elif lab_count != expected['lab_assignments']:
                print(f"❌ Lab assignment count mismatch")
                all_passed = False
            else:
                print(f"✅ MyAssignmentsPage data correct")
                
        except Exception as e:
            print(f"❌ Assignments test error: {e}")
            all_passed = False
            continue
        
        # Step 3: Test MySchedulePage data
        print(f"\n📅 Step 3: My Schedule Page Test")
        try:
            # Get timetables list
            timetables_response = requests.get(f"{base_url}/timetable/list", headers=headers)
            if timetables_response.status_code != 200:
                print(f"❌ Timetables API failed: {timetables_response.status_code}")
                all_passed = False
                continue
                
            timetables = timetables_response.json()
            active_timetables = [tt for tt in timetables if tt.get('status') != 'archived']
            
            print(f"   Active timetables: {len(active_timetables)} (expected: {expected['timetables']})")
            
            # Get schedule slots from all timetables
            total_slots = 0
            timetable_details = []
            
            for tt in active_timetables:
                try:
                    schedule_response = requests.get(
                        f"{base_url}/timetable/{tt['id']}/my-schedule",
                        headers=headers
                    )
                    if schedule_response.status_code == 200:
                        schedule_data = schedule_response.json()
                        slots = schedule_data.get('slots', [])
                        if slots:
                            total_slots += len(slots)
                            timetable_details.append(f"TT {tt['id']}: {len(slots)} slots")
                except:
                    pass
            
            print(f"   Schedule slots: {total_slots} (expected: {expected['schedule_slots']})")
            for detail in timetable_details:
                print(f"     {detail}")
            
            # Verify schedule
            if len(active_timetables) != expected['timetables']:
                print(f"❌ Timetable count mismatch")
                all_passed = False
            elif total_slots != expected['schedule_slots']:
                print(f"❌ Schedule slots count mismatch")
                all_passed = False
            else:
                print(f"✅ MySchedulePage data correct")
                
        except Exception as e:
            print(f"❌ Schedule test error: {e}")
            all_passed = False
            continue
        
        # Step 4: Cross-department verification
        print(f"\n🌐 Step 4: Cross-Department Verification")
        cross_dept_assignments = [a for a in assignments if a.get('department_name') not in [login_data.get('department_name', '')]]
        if cross_dept_assignments:
            print(f"✅ Cross-department assignments found: {len(cross_dept_assignments)}")
            for a in cross_dept_assignments[:3]:  # Show first 3
                print(f"     {a.get('subject_code')} in {a.get('department_name')}")
        else:
            print(f"ℹ️  No cross-department assignments (user may only teach in own department)")
        
        # Step 5: Frontend experience summary
        print(f"\n📱 Step 5: Expected Frontend Experience")
        print(f"   MyAssignmentsPage should show:")
        print(f"     - {len(assignments)} total assignments")
        print(f"     - Grouped by {len(departments)} departments")
        print(f"     - {theory_count} theory + {lab_count} lab subjects")
        
        print(f"   MySchedulePage should show:")
        if total_slots > 0:
            print(f"     - Timetable grid with {total_slots} scheduled slots")
            print(f"     - Cross-department view enabled")
        else:
            print(f"     - Assignment-based schedule fallback")
            print(f"     - Message: 'Schedule Based on Assignments'")
        
        print(f"\n{'✅ PASS' if len(assignments) == expected['assignments'] and total_slots == expected['schedule_slots'] else '❌ FAIL'} - {username.upper()} test complete")
    
    print(f"\n{'='*60}")
    print(f"FINAL RESULT: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    print(f"{'='*60}")
    
    if all_passed:
        print(f"\n🎉 SUCCESS: Teacher schedule system is working correctly!")
        print(f"   - All users can login and get teacher_id")
        print(f"   - Cross-department timetable access working")
        print(f"   - Assignment and schedule data loading properly")
        print(f"   - Frontend should display data correctly")
        print(f"\n📝 USER INSTRUCTIONS:")
        print(f"   1. Logout and login again to get updated session")
        print(f"   2. Check My Assignments page for subject assignments")
        print(f"   3. Check My Schedule page for timetable or assignment-based view")
        print(f"   4. Use Debug page (/dashboard/debug) if issues persist")
    else:
        print(f"\n❌ ISSUES FOUND: Some tests failed")
        print(f"   Check the detailed output above for specific problems")
        print(f"   Users may still experience issues until these are resolved")
    
    return all_passed

if __name__ == "__main__":
    test_complete_user_experience()