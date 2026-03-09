#!/usr/bin/env python3
"""
Manual script to fix database sequences.
Run this if you encounter "duplicate key value" errors when creating records.

Usage:
    python run_sequence_fix.py
"""
from fix_sequences import fix_all_sequences

if __name__ == "__main__":
    print("Fixing database sequences...")
    success = fix_all_sequences()
    if success:
        print("\n✓ All sequences fixed successfully!")
        print("You can now create new records without errors.")
    else:
        print("\n✗ Failed to fix sequences. Check the error messages above.")
