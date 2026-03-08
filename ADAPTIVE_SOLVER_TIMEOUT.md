# Adaptive Solver Timeout - Complete ✅

**Date**: March 3, 2026  
**Status**: Implemented

## Problem
- Fixed 60-second timeout was too short for complex timetables
- Solver found feasible solutions but didn't have time to optimize (apply early dismissal)
- Empty "Teacher Consultation" slots instead of compact schedules

## Solution: Adaptive Timeout

### Timeout Calculation
```python
# Base timeout scales with problem size
if num_tasks < 30:
    base_timeout = 60s      # Small problems
elif num_tasks < 60:
    base_timeout = 120s     # Medium problems
else:
    base_timeout = 180s     # Large problems

# Add 50% more time if early dismissal enabled
if prefer_early_dismissal:
    base_timeout *= 1.5

# Use larger of: configured or adaptive
adaptive_timeout = max(solver_timeout, base_timeout)
```

### Timeout Examples

| Tasks | Early Dismissal | Timeout |
|-------|----------------|---------|
| 20    | No             | 60s     |
| 20    | Yes            | 90s     |
| 40    | No             | 120s    |
| 40    | Yes            | 180s    |
| 70    | No             | 180s    |
| 70    | Yes            | 270s    |

### Why This Works

1. **Small timetables** (1-2 batches): Quick solve, 60-90s enough
2. **Medium timetables** (3-5 batches): Need more time, 120-180s
3. **Large timetables** (6+ batches): Complex, 180-270s
4. **Early dismissal**: Adds 50% time for optimization phase

### Benefits

✅ **Automatic**: No manual configuration needed  
✅ **Scalable**: Adapts to problem complexity  
✅ **Optimal**: Enough time to apply early dismissal penalties  
✅ **Efficient**: Doesn't waste time on simple problems  
✅ **Override**: Still respects GlobalConfig.solver_timeout if higher  

## Implementation

**File**: `backend/solver.py` (lines ~1345-1375)

**Key Changes:**
- Calculate base timeout from task count
- Multiply by 1.5 if early dismissal enabled
- Use max of configured or adaptive timeout
- Log adaptive timeout decision

**Logging:**
```
[SOLVER] Adaptive timeout: 180.0s (tasks: 42, vars: 1848, early_dismissal: True)
[SOLVER] Workers: 8
```

## Expected Results

**Before (60s timeout):**
- Status: FEASIBLE
- Objective: 2,528,318 (high penalties)
- Many empty "Teacher Consultation" slots
- Classes spread out, not compact

**After (adaptive timeout):**
- Status: OPTIMAL or better FEASIBLE
- Objective: < 500,000 (low penalties)
- Compact schedules with early dismissal
- Classes grouped, fewer empty slots

## Testing

Try generating with different batch counts:
1. **1-2 batches**: Should complete in ~60-90s
2. **3-5 batches**: Should complete in ~120-180s
3. **6+ batches**: Should complete in ~180-270s

Monitor logs for:
- Adaptive timeout calculation
- Final objective value (should be lower)
- Status (OPTIMAL is best, FEASIBLE is acceptable)

## Notes

- Timeout is a maximum - solver stops early if optimal found
- Early dismissal needs optimization time, hence 1.5x multiplier
- GlobalConfig.solver_timeout still works as minimum override
- No database changes required
