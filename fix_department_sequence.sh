#!/bin/bash
# Fix department sequence issue
# Run this on the server if you get duplicate key errors when creating departments

echo "Fixing department sequence..."
docker exec tt-postgres psql -U timetable_user -d timetable_db -c "SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id) FROM departments), 1), true);"

echo "Fixing all sequences..."
docker exec tt-backend python fix_sequences.py

echo "Done! You can now create new departments."
