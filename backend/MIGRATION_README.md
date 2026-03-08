# Batch Morning Lab Configuration Migration

## Overview

This migration adds batch-level morning lab configuration fields to consolidate scattered settings from `ScheduleConfig.lab_morning_days` and `GlobalConfig.lab_rules`.

## Migration Files

1. **migrate_batch_morning_lab.py** - Main migration script (standalone, can run directly)
2. **migrations/add_batch_morning_lab_config.py** - Alembic migration (for version-controlled migrations)
3. **test_migration_sample_data.py** - Test script with sample data

## What This Migration Does

### Schema Changes (NON-DESTRUCTIVE)

Adds three new columns to the `batches` table:
- `morning_lab_mode` (VARCHAR): Enforcement level - `null`, `"strict"`, `"prefer"`, or `"count"`
- `morning_lab_count` (INTEGER): Number of labs required in morning (for "count" mode)
- `morning_lab_days` (JSON): List of day indices [0-4] where morning labs apply

**IMPORTANT**: This migration does NOT drop existing columns:
- `ScheduleConfig.lab_morning_days` remains intact
- `GlobalConfig.lab_rules` remains intact
- Backward compatibility is maintained

### Data Migration

The script migrates existing configuration data to the new batch-level fields:

#### 1. GlobalConfig.lab_rules → Batch Configuration (HIGHER PRECEDENCE)

For each rule in `GlobalConfig.lab_rules`:
- Finds matching batch by department code and year
- Sets `morning_lab_mode` based on `strict_mode` flag:
  - `strict_mode: true` → `morning_lab_mode = "strict"`
  - `strict_mode: false` → `morning_lab_mode = "prefer"`
- Copies `morning_days` to `morning_lab_days`

**Example**:
```json
// GlobalConfig.lab_rules
{
  "dept": "CET",
  "batch": 23,
  "morning_days": [0, 1, 2, 3, 4],
  "strict_mode": true
}

// Results in:
// Batch 23CET: morning_lab_mode='strict', morning_lab_days=[0,1,2,3,4]
```

#### 2. ScheduleConfig.lab_morning_days → Batch Configuration (LOWER PRECEDENCE)

For each section with non-empty `lab_morning_days`:
- Groups sections by parent batch
- Computes union of all section days
- Sets `morning_lab_mode = "prefer"` (soft preference)
- Sets `morning_lab_days` to the union of days

**Example**:
```
// ScheduleConfig data
22CE-A: lab_morning_days = [0, 2]      // Monday, Wednesday
22CE-B: lab_morning_days = [0, 1, 2]   // Monday, Tuesday, Wednesday

// Results in:
// Batch 22CE: morning_lab_mode='prefer', morning_lab_days=[0,1,2]
```

**Precedence Rule**: If a batch has configuration from both sources, GlobalConfig takes precedence (it runs first, and ScheduleConfig migration skips batches that already have `morning_lab_mode` set).

## Running the Migration

### Option 1: Standalone Script (Recommended for Testing)

```bash
cd backend
python migrate_batch_morning_lab.py
```

This script:
- Checks if columns already exist
- Adds columns if needed
- Migrates data from both sources
- Logs all actions for review
- Preserves existing data (NON-DESTRUCTIVE)

### Option 2: Alembic Migration (For Production)

```bash
cd backend
alembic upgrade head
```

This uses the version-controlled migration in `migrations/add_batch_morning_lab_config.py`.

## Testing Before Production

**CRITICAL**: Test the migration on sample data before applying to production!

```bash
cd backend
python test_migration_sample_data.py
```

This script:
1. Creates a temporary test database
2. Populates it with sample data (departments, batches, sections, configs)
3. Runs the migration
4. Verifies the results
5. Checks that old data is preserved

**Expected Output**:
```
[TEST] ✓ Migrated 22CE: mode='prefer', days=[0, 1, 2]
[TEST] ✓ Migrated 23CET: mode='strict', days=[0, 1, 2, 3, 4]
[TEST] ✓ Migrated 24EE: mode='prefer', days=[0, 2, 4]
[VERIFY] ✓ Old data preserved - NON-DESTRUCTIVE migration confirmed
```

## Migration Output

The migration logs all actions for review:

```
[MIGRATION] Starting batch morning lab configuration migration...
[MIGRATION] Adding morning_lab_mode column...
[MIGRATION] Adding morning_lab_count column...
[MIGRATION] Adding morning_lab_days column...
[MIGRATION] ✓ Successfully added morning lab configuration fields

[MIGRATION] Migrating data from GlobalConfig.lab_rules...
[MIGRATION] Found 2 lab rule(s) in GlobalConfig
[MIGRATION] ✓ Migrated 23CET: mode='strict', days=[0, 1, 2, 3, 4]
[MIGRATION] ✓ Migrated 24EE: mode='prefer', days=[0, 2, 4]
[MIGRATION] ✓ Migrated 2 batch(es) from GlobalConfig.lab_rules

[MIGRATION] Migrating data from ScheduleConfig.lab_morning_days...
[MIGRATION] ✓ Migrated 22CE: mode='prefer', days=[0, 1, 2]
[MIGRATION]   Sections: 22CE-A, 22CE-B
[MIGRATION] Batch 23CET already has morning_lab_mode=strict - skipping
[MIGRATION] ✓ Migrated 1 batch(es) from ScheduleConfig data

[MIGRATION] ✓ Migration completed successfully
[MIGRATION] ✓ Existing data preserved - backward compatibility maintained
[MIGRATION] ✓ Old fields remain intact
```

## Rollback (Alembic Only)

If using Alembic and you need to rollback:

```bash
cd backend
alembic downgrade -1
```

**WARNING**: Rollback will remove the new columns and their data. The old `ScheduleConfig.lab_morning_days` and `GlobalConfig.lab_rules` data will still be intact (NON-DESTRUCTIVE).

## Verification

After running the migration, verify the results:

```sql
-- Check batch configurations
SELECT b.id, b.year, d.code, 
       b.morning_lab_mode, b.morning_lab_count, b.morning_lab_days
FROM batches b
JOIN departments d ON b.department_id = d.id
ORDER BY b.id;

-- Verify old data is preserved
SELECT COUNT(*) FROM schedule_configs WHERE lab_morning_days != '[]';
SELECT lab_rules FROM global_configs LIMIT 1;
```

## Troubleshooting

### Migration fails with "column already exists"

The migration checks for existing columns and skips schema changes if they exist. If you see this error, the columns were added but data migration may not have completed. Run the script again - it will skip schema changes and proceed to data migration.

### No data migrated

Check that you have data in the source tables:
```sql
SELECT * FROM schedule_configs WHERE lab_morning_days != '[]';
SELECT lab_rules FROM global_configs;
```

If these are empty, there's no data to migrate (this is normal for new installations).

### Batch not found for rule

If you see "No batch found for {year}{dept_code}", the GlobalConfig.lab_rules contains a rule for a batch that doesn't exist in the database. This is safe to ignore - the rule will be skipped.

## Next Steps

After migration:

1. **Update solver.py** to read batch-level configuration instead of scattered settings
2. **Update frontend UI** to configure morning labs at batch level
3. **Deprecate old fields** in UI (keep in database for backward compatibility)
4. **Test timetable generation** with new batch-level configuration

## Support

For issues or questions, refer to:
- Design document: `.kiro/specs/morning-lab-consolidation/design.md`
- Requirements: `.kiro/specs/morning-lab-consolidation/bugfix.md`
- Tasks: `.kiro/specs/morning-lab-consolidation/tasks.md`
