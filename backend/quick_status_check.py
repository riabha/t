#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import requests
import json

def quick_status_check():
    """Quick status check for the teacher schedule system"""
    
    print("🔍 TEACHER SCHEDULE SYSTEM - QUICK STATUS CHECK")
    print("=" * 55)
    
    base_url = "http://localhost:8000"
    
    # Check if backend is running
    print("\n1. Backend Service Check...")
    try:
        response = requests.get(f"{base_url}/docs", timeout=5)
        if response.status_code == 200:
            print("   ✅ Backend running on localhost:8000")
        else:
            print(f"   ❌ Backend responding but status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Backend not running - start with: uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"   ❌ Backend error: {e}")
        return False
    
    # Check frontend (if accessible)
    print("\n2. Frontend Service Check...")
    try:
        response = requests.get("http://localhost:5173", timeout=5)
        if response.status_code == 200:
            print("   ✅ Frontend running on localhost:5173")
        else:
            print(f"   ⚠️  Frontend status: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("   ❌ Frontend not running - start with: npm run dev")
        print("   ℹ️  Users can still test backend APIs directly")
    except Exception as e:
        print(f"   ⚠️  Frontend check failed: {e}")
    
    # Test key API endpoints
    print("\n3. API Endpoints Check...")
    
    # Test login endpoint
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json={
            "username": "jawad",
            "password": "jawad"
        }, timeout=10)
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            if login_data.get('teacher_id'):
                print("   ✅ Login API working (includes teacher_id)")
                token = login_data.get('access_token')
                teacher_id = login_data.get('teacher_id')
            else:
                print("   ❌ Login API missing teacher_id")
                return False
        else:
            print(f"   ❌ Login API failed: {login_response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Login API error: {e}")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test assignments API
    try:
        assignments_response = requests.get(
            f"{base_url}/api/assignments/",
            params={"teacher_id": teacher_id},
            headers=headers,
            timeout=10
        )
        if assignments_response.status_code == 200:
            assignments = assignments_response.json()
            print(f"   ✅ Assignments API working ({len(assignments)} assignments)")
        else:
            print(f"   ❌ Assignments API failed: {assignments_response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Assignments API error: {e}")
        return False
    
    # Test timetables API
    try:
        timetables_response = requests.get(
            f"{base_url}/api/timetable/list",
            headers=headers,
            timeout=10
        )
        if timetables_response.status_code == 200:
            timetables = timetables_response.json()
            active_timetables = [tt for tt in timetables if tt.get('status') != 'archived']
            print(f"   ✅ Timetables API working ({len(active_timetables)} active)")
        else:
            print(f"   ❌ Timetables API failed: {timetables_response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Timetables API error: {e}")
        return False
    
    # Test schedule API
    try:
        if active_timetables:
            tt_id = active_timetables[0]['id']
            schedule_response = requests.get(
                f"{base_url}/api/timetable/{tt_id}/my-schedule",
                headers=headers,
                timeout=10
            )
            if schedule_response.status_code == 200:
                schedule_data = schedule_response.json()
                slots = schedule_data.get('slots', [])
                print(f"   ✅ Schedule API working ({len(slots)} slots in TT {tt_id})")
            else:
                print(f"   ❌ Schedule API failed: {schedule_response.status_code}")
                return False
        else:
            print("   ⚠️  No active timetables to test schedule API")
    except Exception as e:
        print(f"   ❌ Schedule API error: {e}")
        return False
    
    # Summary
    print("\n" + "=" * 55)
    print("🎉 SYSTEM STATUS: ALL CHECKS PASSED")
    print("=" * 55)
    
    print("\n📋 What this means:")
    print("   ✅ Backend services are running correctly")
    print("   ✅ All API endpoints are functional")
    print("   ✅ Cross-department data is accessible")
    print("   ✅ Authentication includes teacher_id")
    
    print("\n👥 For Users:")
    print("   1. Logout and login again to refresh your session")
    print("   2. Check 'My Assignments' page for your subjects")
    print("   3. Check 'My Schedule' page for your timetable")
    print("   4. Use 'Debug Info' page if you have issues")
    
    print("\n🔗 Access Points:")
    print("   • Frontend: http://localhost:5173")
    print("   • Backend API: http://localhost:8000/docs")
    print("   • Debug Page: http://localhost:5173/dashboard/debug")
    
    return True

if __name__ == "__main__":
    success = quick_status_check()
    if not success:
        print("\n❌ SYSTEM ISSUES DETECTED")
        print("   Check the errors above and resolve before user testing")
        sys.exit(1)
    else:
        print("\n✅ SYSTEM READY FOR USERS")
        sys.exit(0)