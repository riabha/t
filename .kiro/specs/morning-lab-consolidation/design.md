# Morning Lab Consolidation Bugfix Design

## Overview

This bugfix consolidates scattered morning lab configuration settings into a single, authoritative location at the batch level. Currently, morning lab settings exist in three places (Restrictions page, Solver settings, and Timetable generation page) with unclear precedence and insufficient enforcement. The fix introduces batch-level morning lab configuration fields, strengthens solver penalty weights, removes scattered UI checkboxes, and provides clear visual indicators for batches with morning lab requirements.

The solution ensures that when a user configures "All labs in morning" for a batch like CET, the solver strictly enforces this requirement, eliminating afternoon lab scheduling and providing a persistent, user-friendly configuration experience.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when morning lab settings are scattered across multiple locations with weak enforcement
- **Property (P)**: The desired behavior - batch-level morning lab configuration with strict enforcement and clear precedence
- **Preservation**: Existing scheduling behavior for batches without morning lab requirements must remain unchanged
- **Batch**: A cohort of students (e.g., 22CE, 23CET) that may contain multiple sections
- **Section**: A subdivision of a batch (e.g., 22CE-A, 22CE-B)
- **Morning Lab**: A 3-hour lab block scheduled in slots 0-1-2 (08:30-11:30)
- **Afternoon Lab**: A 3-hour lab block scheduled in slots 3+ (after 11:00)
- **Penalty Weight**: Numerical cost in the solver's objective function that influences scheduling decisions
- **Strict Enforcement**: Hard constraint that prevents afternoon labs entirely (not just a preference)

## Bug Details

### Fault Condition

The bug manifests when a user attempts to configure morning lab requirements for a batch (e.g., CET). The system currently scatters configuration across three locations, provides no clear precedence rules, uses insufficient penalty weights (ls * 1000) that fail to override afternoon preferences, and requires manual section selection for every timetable generation.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TimetableGenerationRequest
  OUTPUT: boolean
  
  RETURN (input.batch HAS morning_lab_requirement)
         AND (morning_lab_settings SCATTERED across multiple_locations)
         AND (penalty_weight INSUFFICIENT to override afternoon_preference)
         AND (configuration NOT persistent across generations)
         AND (NO clear_precedence_rules)
END FUNCTION
```

### Examples

- **Example 1**: User configures "All labs in morning" for CET batch on Restrictions page, but also checks individual sections on Timetable generation page → System provides no indication which setting takes precedence, resulting in unpredictable behavior

- **Example 2**: User selects CET sections for morning labs during timetable generation → Solver still schedules labs in afternoon because morning lab penalty (ls * 1000) is weaker than base afternoon preference penalties

- **Example 3**: User wants all CET labs in morning → Must manually check section checkboxes for every timetable generation, with no persistent batch-level configuration

- **Example 4**: User sets conflicting morning lab preferences in GlobalConfig.lab_rules and per-section checkboxes → System does not validate or warn about conflicts, allowing contradictory configurations

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Batches without morning lab requirements must continue to schedule labs according to existing solver logic
- Afternoon lab scheduling for non-morning-lab batches must remain unchanged
- Other constraints (room availability, teacher conflicts, no-gaps, etc.) must continue to work with existing priority levels
- Existing timetable generation functionality for non-morning-lab features must provide the same interface and behavior

**Scope:**
All batches that do NOT have morning lab requirements configured should be completely unaffected by this fix. This includes:
- Default lab scheduling behavior (afternoon preference)
- Existing penalty-based optimization approach
- Current constraint enforcement priorities
- UI elements unrelated to morning lab configuration

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Scattered Configuration Architecture**: Morning lab settings exist in three separate locations:
   - `ScheduleConfig.lab_morning_days` (per-section, in Restrictions page)
   - `GlobalConfig.lab_rules` (batch-level rules in solver settings)
   - `morning_lab_section_ids` parameter (per-generation checkboxes on Timetable page)
   - No clear hierarchy or precedence rules between these settings

2. **Insufficient Penalty Weights**: The current penalty weight `ls * 1000` (where ls is the lab start slot) is too weak:
   - For slot 3 (first afternoon slot): penalty = 3000
   - Base afternoon preference penalties and other constraints can easily override this
   - No strict enforcement mechanism for "all labs must be in morning"

3. **Non-Persistent Configuration**: The `morning_lab_section_ids` parameter is passed per-generation:
   - User must manually select sections every time they generate a timetable
   - No batch-level persistence in the database
   - Cumbersome UX for recurring requirements like "CET always needs morning labs"

4. **Lack of Strict Enforcement Mode**: Current implementation uses soft preferences (penalties):
   - No hard constraint option to completely prevent afternoon labs
   - "All labs in morning" requirement cannot be guaranteed
   - Solver may still schedule afternoon labs if penalties are insufficient

## Correctness Properties

Property 1: Fault Condition - Batch-Level Morning Lab Configuration

_For any_ batch where morning lab requirements are configured at the batch level (e.g., "All labs in morning" for CET), the fixed system SHALL persist these settings in the database, apply them automatically to all timetable generations for that batch, and enforce them with sufficient strength to prevent afternoon lab scheduling.

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

Property 2: Preservation - Non-Morning-Lab Batch Behavior

_For any_ batch where morning lab requirements are NOT configured, the fixed system SHALL produce exactly the same scheduling behavior as the original system, preserving existing solver logic, penalty weights, and constraint priorities for afternoon lab scheduling.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**1. Database Schema Changes**

**File**: `backend/models.py`

**Model**: `Batch`

**Specific Changes**:
1. **Add morning_lab_mode field**: Enum field to specify the enforcement level
   - Values: `null` (no requirement), `"strict"` (all labs in morning), `"prefer"` (soft preference), `"count"` (specific number required)
   - Default: `null` (no morning lab requirement)

2. **Add morning_lab_count field**: Integer field for "count" mode
   - Specifies how many labs should be in morning (e.g., 2 out of 3)
   - Only used when `morning_lab_mode = "count"`
   - Default: `null`

3. **Add morning_lab_days field**: JSON field to specify which days
   - List of day indices [0-4] where morning labs are preferred
   - Empty list means all days are eligible
   - Default: `[]` (all days eligible)

**Example Schema Addition**:
```python
class Batch(Base):
    # ... existing fields ...
    
    # Morning lab configuration
    morning_lab_mode = Column(String, nullable=True)  # null, "strict", "prefer", "count"
    morning_lab_count = Column(Integer, nullable=True)  # for "count" mode
    morning_lab_days = Column(JSON, nullable=False, default=list)  # [0,1,2,3,4]
```

**2. Backend API Changes**

**File**: `backend/routers/departments.py`

**Endpoints to Update**:
1. **Update BatchCreate schema** (`backend/schemas.py`):
   - Add `morning_lab_mode`, `morning_lab_count`, `morning_lab_days` fields
   
2. **Update BatchOut schema** (`backend/schemas.py`):
   - Include morning lab fields in response

3. **Update PUT /batches/{batch_id}** endpoint:
   - Accept and validate morning lab configuration fields
   - Validate that `morning_lab_count` is only set when mode is "count"
   - Validate that `morning_lab_days` contains valid day indices [0-4]

**3. Solver Logic Changes**

**File**: `backend/solver.py`

**Function**: `generate_timetable`

**Specific Changes**:
1. **Load batch-level morning lab configuration**:
   - Query Batch model for morning_lab_mode, morning_lab_count, morning_lab_days
   - Build a mapping: `batch_id -> {mode, count, days}`

2. **Strengthen penalty weights for "strict" mode**:
   - Current: `penalties.append(v * (ls * 1000))` for non-morning slots
   - New for strict mode: Use hard constraint instead of penalty
   - Implementation: `model.Add(x_lab[ti, d, ls] == 0)` for all ls > 0 (afternoon slots)

3. **Implement "prefer" mode with stronger penalties**:
   - Increase penalty multiplier from 1000 to 10000 for non-morning slots
   - `penalties.append(v * (ls * 10000))` when mode is "prefer"

4. **Implement "count" mode**:
   - Add constraint: `sum(morning_lab_vars) >= morning_lab_count`
   - Where `morning_lab_vars` are all lab variables with start slot = 0

5. **Remove morning_lab_section_ids parameter**:
   - Delete parameter from function signature
   - Remove all logic that checks `morning_lab_section_ids`
   - Replace with batch-level configuration lookup

6. **Update precedence logic**:
   - Batch-level configuration takes highest precedence
   - Remove GlobalConfig.lab_rules logic (deprecated by batch-level config)
   - Remove ScheduleConfig.lab_morning_days logic (deprecated by batch-level config)

**Pseudocode for Strict Mode Enforcement**:
```python
# For each lab task
for ti, task in enumerate(tasks):
    batch_config = batch_morning_lab_config.get(task["batch_id"])
    
    if batch_config and batch_config["mode"] == "strict":
        # Hard constraint: only allow morning lab starts (slot 0)
        for d in range(4):  # Mon-Thu
            for ls in lab_starts[d]:
                if ls > 0:  # Afternoon slot
                    if (ti, d, ls) in x_lab:
                        # Force this variable to 0 (never schedule here)
                        model.Add(x_lab[ti, d, ls] == 0)
```

**4. Frontend UI Changes**

**File**: `frontend/src/pages/RestrictionsPage.jsx` OR `frontend/src/pages/SettingsPage.jsx`

**Specific Changes**:
1. **Add new "Batch Lab Scheduling" section**:
   - Display all batches grouped by department
   - For each batch, show inline configuration controls or edit button
   
2. **Create morning lab configuration UI**:
   - Dropdown for mode: "No requirement", "All labs in morning (strict)", "Prefer morning labs", "Specific count"
   - Number input for count (shown only when mode is "count")
   - Day checkboxes for morning_lab_days (optional, defaults to all days)
   - Save button to persist configuration
   
3. **Add visual indicators**:
   - Badge/icon on batches with morning lab requirements
   - Color coding: green for "strict", blue for "prefer", yellow for "count"
   - Tooltip showing configuration details
   
4. **Deprecate per-section morning lab configuration**:
   - Keep existing `lab_morning_days` section but add deprecation notice
   - Gray out or disable editing of per-section settings
   - Add notice: "Morning lab configuration has moved to batch-level settings below."
   - Keep existing data for backward compatibility but prioritize batch-level config

**File**: `frontend/src/pages/TimetablePage.jsx`

**Specific Changes**:
1. **Remove morning lab section checkboxes**:
   - Delete the entire "Morning Labs — Select Sections" UI block
   - Remove `morningLabSectionIds` state variable
   - Remove `morning_lab_section_ids` from API request payload

2. **Add informational display**:
   - Show which batches have morning lab requirements configured
   - Display: "Morning lab settings are configured in Restrictions/Settings page."
   - Link to Restrictions or Settings page

**5. Migration Strategy**

**File**: Create `backend/migrations/add_batch_morning_lab_config.py`

**Specific Changes**:
1. **Add new columns to Batch table**:
   - `morning_lab_mode`, `morning_lab_count`, `morning_lab_days`

2. **Migrate existing ScheduleConfig.lab_morning_days data**:
   - For each section with non-empty `lab_morning_days`
   - Set parent batch's `morning_lab_mode = "prefer"`
   - Set parent batch's `morning_lab_days` to union of all section days
   - Log migration actions for review

3. **Migrate existing GlobalConfig.lab_rules data**:
   - For each lab_rule with dept/batch matching
   - Set corresponding batch's morning lab configuration
   - Preserve strict_mode flag as `morning_lab_mode = "strict"`

4. **Backward compatibility**:
   - Keep ScheduleConfig.lab_morning_days field (don't drop)
   - Keep GlobalConfig.lab_rules field (don't drop)
   - Solver ignores these fields if batch-level config exists

**6. Precedence Rules**

Clear hierarchy when multiple settings exist:

1. **Highest Priority**: Batch-level configuration (new system)
   - `Batch.morning_lab_mode`, `morning_lab_count`, `morning_lab_days`
   
2. **Deprecated (ignored if batch config exists)**: GlobalConfig.lab_rules
   - Only used if batch has no morning_lab_mode set
   
3. **Deprecated (ignored if batch config exists)**: ScheduleConfig.lab_morning_days
   - Only used if batch has no morning_lab_mode set
   
4. **Lowest Priority**: Default solver behavior
   - Afternoon preference for labs

**Implementation in Solver**:
```python
# Precedence logic
batch_config = batch.morning_lab_mode  # Check batch first

if not batch_config:
    # Fallback to GlobalConfig.lab_rules (deprecated)
    for rule in lab_rules:
        if matches_batch(rule, batch):
            batch_config = rule
            break

if not batch_config:
    # Fallback to ScheduleConfig.lab_morning_days (deprecated)
    section_configs = get_section_configs(batch.sections)
    if any(config.lab_morning_days for config in section_configs):
        batch_config = merge_section_configs(section_configs)

# If still no config, use default behavior (afternoon preference)
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Create test scenarios that configure morning lab requirements in multiple ways and observe the solver's behavior on UNFIXED code. Document cases where afternoon labs are scheduled despite morning lab preferences, and cases where configuration is lost between generations.

**Test Cases**:
1. **Scattered Configuration Test**: Configure morning labs in all three locations (ScheduleConfig, GlobalConfig, TimetablePage checkboxes) with conflicting values → Observe which setting wins (will demonstrate unclear precedence on unfixed code)

2. **Weak Penalty Test**: Configure CET sections for morning labs, generate timetable → Observe that labs are still scheduled in afternoon slots (will fail on unfixed code, demonstrating insufficient penalty weight)

3. **Non-Persistent Configuration Test**: Select sections for morning labs, generate timetable, then generate again without re-selecting → Observe that morning lab preference is lost (will fail on unfixed code)

4. **Strict Enforcement Test**: Configure "all labs in morning" requirement → Observe that solver still schedules some labs in afternoon (will fail on unfixed code)

**Expected Counterexamples**:
- Labs scheduled in afternoon despite morning lab preference (penalty too weak)
- Configuration lost between timetable generations (no persistence)
- Conflicting settings produce unpredictable results (no precedence rules)
- Possible causes: insufficient penalty weights, non-persistent configuration, scattered architecture

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL batch WHERE batch.morning_lab_mode IS NOT NULL DO
  timetable := generate_timetable_fixed(batch)
  
  IF batch.morning_lab_mode == "strict" THEN
    ASSERT all_labs_in_morning(timetable, batch)
  END IF
  
  IF batch.morning_lab_mode == "prefer" THEN
    ASSERT most_labs_in_morning(timetable, batch)
  END IF
  
  IF batch.morning_lab_mode == "count" THEN
    ASSERT count_morning_labs(timetable, batch) >= batch.morning_lab_count
  END IF
  
  # Verify persistence
  timetable2 := generate_timetable_fixed(batch)  # Generate again
  ASSERT same_morning_lab_behavior(timetable, timetable2)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL batch WHERE batch.morning_lab_mode IS NULL DO
  timetable_original := generate_timetable_original(batch)
  timetable_fixed := generate_timetable_fixed(batch)
  
  ASSERT same_lab_scheduling_pattern(timetable_original, timetable_fixed)
  ASSERT same_penalty_application(timetable_original, timetable_fixed)
  ASSERT same_constraint_enforcement(timetable_original, timetable_fixed)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for batches without morning lab requirements, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Default Lab Scheduling Preservation**: For batches with no morning lab config, verify labs are scheduled in afternoon slots as before (observe on unfixed code, then test after fix)

2. **Penalty Weight Preservation**: For batches with no morning lab config, verify penalty calculations remain unchanged (observe on unfixed code, then test after fix)

3. **Constraint Priority Preservation**: For batches with no morning lab config, verify other constraints (room availability, teacher conflicts) work with same priority (observe on unfixed code, then test after fix)

4. **UI Behavior Preservation**: For timetable generation without morning lab requirements, verify UI provides same interface and options (observe on unfixed code, then test after fix)

### Unit Tests

- Test Batch model with morning lab configuration fields (create, update, validate)
- Test BatchCreate/BatchOut schemas with new fields
- Test API endpoints for batch morning lab configuration (CRUD operations)
- Test solver logic for each morning lab mode (strict, prefer, count)
- Test penalty weight calculations for different modes
- Test precedence logic (batch config overrides deprecated settings)
- Test migration script (existing data correctly migrated)
- Test UI components for morning lab configuration (form validation, visual indicators)

### Property-Based Tests

- Generate random batch configurations and verify solver respects morning lab mode
- Generate random timetable generation requests and verify persistence across generations
- Generate random combinations of deprecated settings and verify precedence rules
- Test that batches without morning lab config produce same results as original solver

### Integration Tests

- Test full workflow: configure batch morning lab settings → generate timetable → verify enforcement
- Test migration: existing ScheduleConfig data → batch-level config → timetable generation
- Test UI flow: Batches page configuration → Timetable generation → visual indicators
- Test precedence: conflicting settings in multiple locations → batch config wins
- Test strict mode: CET batch with "all labs in morning" → no afternoon labs in generated timetable
