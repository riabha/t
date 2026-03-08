"""
Test VC API access
Run: python test_vc_api_access.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_vc_access():
    print("=== Testing VC API Access ===\n")
    
    # Step 1: Login as VC
    print("1. Logging in as VC...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": "vc", "password": "vc"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"   Response: {login_response.text}")
        return
    
    token = login_response.json().get("access_token")
    print(f"✅ Login successful")
    print(f"   Token: {token[:50]}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Test departments endpoint
    print("\n2. Testing /departments/ endpoint...")
    dept_response = requests.get(f"{BASE_URL}/departments/", headers=headers)
    if dept_response.status_code == 200:
        depts = dept_response.json()
        print(f"✅ Departments: {len(depts)} found")
        for dept in depts[:3]:
            print(f"   - {dept['name']} ({dept['code']})")
    else:
        print(f"❌ Failed: {dept_response.status_code}")
    
    # Step 3: Test timetable list endpoint
    print("\n3. Testing /timetable/list endpoint...")
    tt_response = requests.get(f"{BASE_URL}/timetable/list", headers=headers)
    if tt_response.status_code == 200:
        tts = tt_response.json()
        print(f"✅ Timetables: {len(tts)} found")
        for tt in tts[:3]:
            print(f"   - {tt['name']} (ID: {tt['id']}, Status: {tt['status']})")
        
        # Step 4: Test timetable detail endpoint
        if tts:
            tt_id = tts[0]['id']
            print(f"\n4. Testing /timetable/{tt_id} endpoint...")
            detail_response = requests.get(f"{BASE_URL}/timetable/{tt_id}", headers=headers)
            if detail_response.status_code == 200:
                detail = detail_response.json()
                print(f"✅ Timetable detail loaded")
                print(f"   Name: {detail['name']}")
                print(f"   Slots: {len(detail.get('slots', []))} slots")
                print(f"   Sections: {len(detail.get('sections', []))} sections")
            else:
                print(f"❌ Failed: {detail_response.status_code}")
                print(f"   Response: {detail_response.text}")
    else:
        print(f"❌ Failed: {tt_response.status_code}")
        print(f"   Response: {tt_response.text}")
    
    # Step 5: Test teachers endpoint
    print("\n5. Testing /teachers/ endpoint...")
    teacher_response = requests.get(f"{BASE_URL}/teachers/", headers=headers)
    if teacher_response.status_code == 200:
        teachers = teacher_response.json()
        print(f"✅ Teachers: {len(teachers)} found")
    else:
        print(f"❌ Failed: {teacher_response.status_code}")
    
    # Step 6: Test subjects endpoint
    print("\n6. Testing /subjects/ endpoint...")
    subject_response = requests.get(f"{BASE_URL}/subjects/", headers=headers)
    if subject_response.status_code == 200:
        subjects = subject_response.json()
        print(f"✅ Subjects: {len(subjects)} found")
    else:
        print(f"❌ Failed: {subject_response.status_code}")
    
    # Step 7: Test rooms endpoint
    print("\n7. Testing /rooms/ endpoint...")
    room_response = requests.get(f"{BASE_URL}/rooms/", headers=headers)
    if room_response.status_code == 200:
        rooms = room_response.json()
        print(f"✅ Rooms: {len(rooms)} found")
    else:
        print(f"❌ Failed: {room_response.status_code}")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    try:
        test_vc_access()
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend server")
        print("   Make sure the backend is running on http://localhost:8000")
    except Exception as e:
        print(f"❌ ERROR: {e}")
