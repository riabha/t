#!/usr/bin/env python3
from database import SessionLocal
from models import Batch

db = SessionLocal()
batches = db.query(Batch).all()

print("\nAll batches:")
for b in batches:
    print(f"  ID: {b.id}, Name: {b.display_name}, Year: {b.year}, Dept: {b.department.code}")

db.close()
