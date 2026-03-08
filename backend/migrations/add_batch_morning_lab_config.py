"""
Alembic Migration: Add Batch Morning Lab Configuration Fields

This migration adds three new fields to the Batch model for consolidated morning lab configuration:
- morning_lab_mode: Enforcement level (null, "strict", "prefer", "count")
- morning_lab_count: Number of labs required in morning (for "count" mode)
- morning_lab_days: Which days to apply the rule [0-4]

IMPORTANT: This is a NON-DESTRUCTIVE migration
- Adds new columns only
- Does NOT drop existing ScheduleConfig.lab_morning_days or GlobalConfig.lab_rules
- Existing data remains intact
- Backward compatibility maintained
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers
revision = 'add_batch_morning_lab'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    """
    Add morning lab configuration fields to Batch table.
    
    NON-DESTRUCTIVE: Only adds new columns, does not modify or drop existing data.
    """
    # Add morning_lab_mode column
    op.add_column('batches', sa.Column('morning_lab_mode', sa.String(), nullable=True))
    
    # Add morning_lab_count column
    op.add_column('batches', sa.Column('morning_lab_count', sa.Integer(), nullable=True))
    
    # Add morning_lab_days column (JSON array)
    op.add_column('batches', sa.Column('morning_lab_days', sa.JSON(), nullable=False, server_default='[]'))
    
    print("[MIGRATION] Added morning lab configuration fields to Batch table")
    print("[MIGRATION] Existing data preserved - all batches have NULL morning_lab_mode by default")


def downgrade():
    """
    Remove morning lab configuration fields from Batch table.
    
    WARNING: This will remove the morning lab configuration data.
    """
    op.drop_column('batches', 'morning_lab_days')
    op.drop_column('batches', 'morning_lab_count')
    op.drop_column('batches', 'morning_lab_mode')
    
    print("[MIGRATION ROLLBACK] Removed morning lab configuration fields from Batch table")
