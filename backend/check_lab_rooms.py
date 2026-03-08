#!/usr/bin/env python3
"""Check lab room availability."""

from database import SessionLocal
from models import Room, Assignment, Batch

db = SessionLocal()

print(f"\n{'='*80}")
print(f"LAB ROOM AVAILABILITY CHECK")
print(f"{'='*80}\n")

# Get all lab rooms
lab_rooms = db.query(Room).filter(Room.is_lab == True).all()

print(f"Total lab rooms: {len(lab_rooms)}\n")

for room in lab_rooms:
    print(f"  {room.name} (Capacity: {room.capacity})")

# Get 23BAE batch
batch = db.query(Batch).filter(Batch.year == 23).join(Batch.department).filter_by(code="BAE").first()

if batch:
    # Get assignments with labs
    assignments = db.query(Assignment).filter(Assignment.batch_id == batch.id).all()
    
    print(f"\n23BAE Lab Requirements:")
    total_lab_blocks = 0
    for asg in assignments:
        subject = asg.subject
        if subject.lab_credits > 0:
            lab_blocks = subject.lab_credits
            total_lab_blocks += lab_blocks
            print(f"  {subject.code}: {lab_blocks} lab block(s) = {lab_blocks * 3} slots")
    
    print(f"\nTotal lab blocks needed: {total_lab_blocks}")
    print(f"Available lab rooms: {len(lab_rooms)}")
    
    # Calculate lab slot capacity
    # 13 lab start positions per week (from diagnostics)
    lab_capacity_per_room = 13
    total_lab_capacity = len(lab_rooms) * lab_capacity_per_room
    
    print(f"\nLab capacity analysis:")
    print(f"  Lab start positions per week: {lab_capacity_per_room}")
    print(f"  Total lab capacity: {len(lab_rooms)} rooms × {lab_capacity_per_room} = {total_lab_capacity} blocks/week")
    print(f"  23BAE needs: {total_lab_blocks} blocks")
    
    if total_lab_blocks > total_lab_capacity:
        print(f"\n⚠️  INSUFFICIENT LAB CAPACITY!")
        print(f"  Need {total_lab_blocks - total_lab_capacity} more lab room slots")
    elif len(lab_rooms) < total_lab_blocks:
        print(f"\n⚠️  POTENTIAL ISSUE: {total_lab_blocks} labs need to run, but only {len(lab_rooms)} lab rooms")
        print(f"  Some labs will need to be scheduled at different times")
    else:
        print(f"\n✓ Sufficient lab capacity")

print(f"\n{'='*80}\n")

db.close()
