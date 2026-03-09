#!/bin/bash
# Script to fix database sequences in production
# Run this inside the Docker container

echo "Fixing database sequences..."
python3 fix_sequences.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Sequences fixed successfully!"
    echo "You can now create rooms, labs, subjects, and batches."
else
    echo ""
    echo "✗ Failed to fix sequences. Check the error messages above."
    exit 1
fi
