-- Create VC user account
-- Username: vc
-- Password: vc
-- Run this SQL directly in your database

INSERT INTO users (username, hashed_password, role, full_name, email, department_id)
VALUES (
    'vc',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN96UUeP/9C0L8yNd.sCO',  -- This is bcrypt hash of "vc"
    'super_admin',
    'Vice Chancellor',
    'vc@quest.edu.pk',
    NULL
)
ON CONFLICT (username) DO NOTHING;
