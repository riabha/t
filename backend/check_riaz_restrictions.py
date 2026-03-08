"""
Check Prof. Dr. Riaz Bhanbhro's restrictions and Friday assignments
"""

from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=" * 80)
print("CHECKING PROF. DR. RIAZ BHANBHRO - RESTRICTIONS AND ASSIGNMENTS")
print("=" * 80)
print()

# Find Riaz
teacher = db.execute(text("""
    SELECT id, name, designation, department_id
    FROM teachers
    WHERE name LIKE '%Riaz%'
""")).fetchone()

if not teacher:
    print("❌ Teacher not found")
    db.close()
    exit()

teacher_id, name, designation, dept_id = teacher
print(f"Teacher: {name}")
print(f"Designation: {designation}")
print(f"Departm