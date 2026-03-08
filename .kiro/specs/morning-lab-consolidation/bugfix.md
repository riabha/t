# Bugfix Requirements Document

## Introduction

The morning lab configuration system currently suffers from scattered settings across multiple locations (Restrictions page, Solver settings, and Timetable generation page), creating confusion about precedence, potential conflicts, and a cumbersome user experience. This bug particularly affects CET (Computer Engineering Technology) where users need to ensure all labs are scheduled in the morning, but the current per-section checkbox approach fails to enforce this requirement, and the penalty weighting is insufficient to override afternoon scheduling preferences.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user configures morning lab settings in multiple locations (Restrictions page, Solver settings, Timetable generation page) THEN the system provides no clear indication of which setting takes precedence, leading to unpredictable scheduling behavior

1.2 WHEN a user selects sections for morning labs during CET timetable generation THEN the system still schedules labs in the afternoon because the morning lab preference penalty (ls * 100) is too weak compared to the base afternoon preference penalty

1.3 WHEN a user wants all labs for a specific batch (e.g., CET) to be scheduled in the morning THEN the system requires manually checking multiple section checkboxes for every timetable generation, with no persistent batch-level configuration

1.4 WHEN morning lab settings exist in different locations with conflicting values THEN the system does not validate or warn about conflicts, allowing contradictory configurations to coexist

1.5 WHEN a user needs to configure morning lab requirements THEN the system scatters the configuration across three different pages, making it unclear where the authoritative setting should be defined

### Expected Behavior (Correct)

2.1 WHEN a user configures morning lab requirements for a batch THEN the system SHALL provide a single, comprehensive location (Batches or Restrictions page) where all morning lab settings are centralized with clear precedence rules

2.2 WHEN a user selects "All labs in morning" for CET batch THEN the system SHALL enforce this as a strict requirement, ensuring labs are never scheduled in the afternoon regardless of other penalty weights

2.3 WHEN a user configures batch-level morning lab settings THEN the system SHALL persist these settings across multiple timetable generations, eliminating the need to manually select sections each time

2.4 WHEN a user sets morning lab preferences at the batch level THEN the system SHALL provide multiple configuration options including "All labs in morning" (strict), "Prefer morning labs" (soft preference), and "Number of morning labs required" (e.g., 2 out of 3)

2.5 WHEN morning lab settings are configured THEN the system SHALL remove scattered checkboxes from the Timetable generation page and consolidate all configuration in one authoritative location

2.6 WHEN the solver evaluates morning lab constraints THEN the system SHALL use penalty weights strong enough to enforce morning lab preferences over conflicting afternoon preferences

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a batch has no morning lab requirements configured THEN the system SHALL CONTINUE TO schedule labs according to existing solver logic and preferences

3.2 WHEN generating timetables for batches without morning lab constraints THEN the system SHALL CONTINUE TO produce valid schedules using the current penalty-based optimization approach

3.3 WHEN the solver processes other constraints (room availability, instructor conflicts, etc.) THEN the system SHALL CONTINUE TO enforce these constraints with their existing priority levels

3.4 WHEN users access existing timetable generation functionality for non-morning-lab features THEN the system SHALL CONTINUE TO provide the same interface and behavior

3.5 WHEN the system evaluates afternoon lab preferences for batches without morning lab requirements THEN the system SHALL CONTINUE TO apply the existing afternoon preference penalties
