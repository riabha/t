import sys
import os
sys.path.append("backend")
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User
from auth import get_current_user

# Simulate a CE program admin (Dept 1)
db = SessionLocal()
admin = db.query(User).filter(User.role == "program_admin", User.department_id == 1).first()
if not admin:
    print("No CE admin found")
    sys.exit(1)

print(f"Testing as Admin: {admin.username} (Dept {admin.department_id})")
app.dependency_overrides[get_current_user] = lambda: admin
client = TestClient(app)

# 1. Fetch sessions
resp = client.get("/api/assignments/sessions")
sessions = resp.json()
print(f"Sessions: {len(sessions)}")

# 2. For each session, fetch assignments
for s in sessions[:3]:  # just test first 3
    print(f"\n--- Testing Session: {s['name']} (ID {s['id']}, Dept {s['department_id']}) ---")
    resp_asgn = client.get(f"/api/assignments/?session_id={s['id']}")
    if resp_asgn.status_code == 200:
        data = resp_asgn.json()
        print(f"  Assignments: {len(data)}")
    else:
        print(f"  Error: {resp_asgn.status_code} - {resp_asgn.text}")

# 3. Fetch teachers (frontend sends no params for AssignmentsPage but viewDeptId for TeachersPage)
# Let's test what TeachersPage sends: /api/teachers/?department_id=1
resp_teachers = client.get("/api/teachers/?department_id=1")
if resp_teachers.status_code == 200:
    data = resp_teachers.json()
    print(f"\nTeachers for Dept 1: {len(data)}")
else:
    print(f"\nError fetching teachers: {resp_teachers.status_code} - {resp_teachers.text}")

db.close()
