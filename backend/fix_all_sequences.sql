-- Fix all database sequences to prevent duplicate key errors
-- This synchronizes sequence values with the actual max IDs in tables

-- Core tables
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id) FROM departments), 1), true);
SELECT setval('batches_id_seq', COALESCE((SELECT MAX(id) FROM batches), 1), true);
SELECT setval('sections_id_seq', COALESCE((SELECT MAX(id) FROM sections), 1), true);
SELECT setval('rooms_id_seq', COALESCE((SELECT MAX(id) FROM rooms), 1), true);
SELECT setval('subjects_id_seq', COALESCE((SELECT MAX(id) FROM subjects), 1), true);
SELECT setval('teachers_id_seq', COALESCE((SELECT MAX(id) FROM teachers), 1), true);
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);

-- Assignment tables
SELECT setval('assignments_id_seq', COALESCE((SELECT MAX(id) FROM assignments), 1), true);
SELECT setval('assignment_sessions_id_seq', COALESCE((SELECT MAX(id) FROM assignment_sessions), 1), true);

-- Timetable tables
SELECT setval('timetables_id_seq', COALESCE((SELECT MAX(id) FROM timetables), 1), true);
SELECT setval('timetable_slots_id_seq', COALESCE((SELECT MAX(id) FROM timetable_slots), 1), true);

-- Configuration tables
SELECT setval('teacher_restrictions_id_seq', COALESCE((SELECT MAX(id) FROM teacher_restrictions), 1), true);
SELECT setval('schedule_configs_id_seq', COALESCE((SELECT MAX(id) FROM schedule_configs), 1), true);
SELECT setval('global_configs_id_seq', COALESCE((SELECT MAX(id) FROM global_configs), 1), true);
SELECT setval('teacher_department_engagements_id_seq', COALESCE((SELECT MAX(id) FROM teacher_department_engagements), 1), true);

-- Display results
SELECT 'All sequences fixed successfully!' as status;
