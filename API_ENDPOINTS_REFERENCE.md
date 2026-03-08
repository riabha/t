# API Endpoints Reference - QUEST Timetable Portal

## 🔐 Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response: {
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": number,
    "username": "string",
    "full_name": "string",
    "role": "string",
    "department_id": number | null
  }
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: {
  "id": number,
  "username": "string",
  "full_name": "string",
  "role": "string",
  "department_id": number | null,
  "department_name": "string" | null
}
```

---

## 👥 User Management

### List All Users
```http
GET /api/users/
Authorization: Bearer <token>
Role: super_admin

Response: [
  {
    "id": number,
    "username": "string",
    "full_name": "string",
    "role": "string",
    "department_id": number | null,
    "department_name": "string" | null,
    "can_manage_restrictions": boolean,
    "can_delete_timetable": boolean
  }
]
```

### Create User
```http
POST /api/users/
Authorization: Bearer <token>
Role: super_admin
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "full_name": "string",
  "role": "super_admin" | "program_admin" | "clerk" | "teacher",
  "department_id": number | null,
  "can_manage_restrictions": boolean,
  "can_delete_timetable": boolean
}

Response: {
  "id": number,
  "username": "string",
  "full_name": "string",
  "role": "string",
  "department_id": number | null
}

Note: If role is "program_admin" and department_id is provided,
      12 default rooms are automatically created for that department.
```

### Update User
```http
PUT /api/users/{user_id}
Authorization: Bearer <token>
Role: super_admin
Content-Type: application/json

{
  "username": "string" | null,  // Cannot be changed
  "full_name": "string" | null,
  "role": "string" | null,
  "department_id": number | null,
  "can_manage_restrictions": boolean | null,
  "can_delete_timetable": boolean | null,
  "password": "string" | null  // Optional, only update if provided
}

Response: {
  "id": number,
  "username": "string",
  "full_name": "string",
  "role": "string",
  "department_id": number | null
}
```

### Delete User
```http
DELETE /api/users/{user_id}
Authorization: Bearer <token>
Role: super_admin

Response: {
  "detail": "User deleted"
}

Note: Cannot delete current user (self-protection)
```

### Change Password
```http
POST /api/users/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "old_password": "string",
  "new_password": "string"
}

Response: {
  "detail": "Password changed successfully"
}

Validation:
- old_password must match current password
- new_password must be at least 6 characters
```

---

## 🏫 Room Management

### List Rooms
```http
GET /api/rooms/
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "name": "string",
    "capacity": number | null,
    "is_lab": boolean,
    "department_id": number | null
  }
]

Filtering:
- program_admin: Only sees their department's rooms
- super_admin: Sees all rooms
- teacher: Sees their department's rooms
```

### Create Room
```http
POST /api/rooms/
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "name": "string",
  "capacity": number | null,
  "is_lab": boolean,
  "department_id": number | null  // Required for super_admin
}

Response: {
  "id": number,
  "name": "string",
  "capacity": number | null,
  "is_lab": boolean,
  "department_id": number
}

Rules:
- program_admin: Automatically uses their department_id
- super_admin: Must specify department_id
```

### Update Room
```http
PUT /api/rooms/{room_id}
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "name": "string",
  "capacity": number | null,
  "is_lab": boolean,
  "department_id": number | null  // Only super_admin can change
}

Response: {
  "id": number,
  "name": "string",
  "capacity": number | null,
  "is_lab": boolean,
  "department_id": number
}

Rules:
- program_admin: Can only edit their department's rooms
- super_admin: Can edit any room
```

### Delete Room
```http
DELETE /api/rooms/{room_id}
Authorization: Bearer <token>
Role: super_admin | program_admin

Response: {
  "ok": true
}

Rules:
- program_admin: Can only delete their department's rooms
- super_admin: Can delete any room
- Fails if room is in use (has assignments)
```

---

## 🏢 Department Management

### List Departments
```http
GET /api/departments/
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "name": "string",
    "code": "string"
  }
]
```

### Create Department
```http
POST /api/departments/
Authorization: Bearer <token>
Role: super_admin
Content-Type: application/json

{
  "name": "string",
  "code": "string"
}

Response: {
  "id": number,
  "name": "string",
  "code": "string"
}
```

### Update Department
```http
PUT /api/departments/{dept_id}
Authorization: Bearer <token>
Role: super_admin
Content-Type: application/json

{
  "name": "string",
  "code": "string"
}

Response: {
  "id": number,
  "name": "string",
  "code": "string"
}
```

### Delete Department
```http
DELETE /api/departments/{dept_id}
Authorization: Bearer <token>
Role: super_admin

Response: {
  "ok": true
}
```

---

## 📚 Subject Management

### List Subjects
```http
GET /api/subjects/
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "code": "string",
    "name": "string",
    "credit_hours": number,
    "has_lab": boolean,
    "department_id": number
  }
]
```

### Create Subject
```http
POST /api/subjects/
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "code": "string",
  "name": "string",
  "credit_hours": number,
  "has_lab": boolean,
  "department_id": number
}

Response: {
  "id": number,
  "code": "string",
  "name": "string",
  "credit_hours": number,
  "has_lab": boolean,
  "department_id": number
}
```

---

## 👨‍🏫 Teacher Management

### List Teachers
```http
GET /api/teachers/
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "name": "string",
    "department_id": number,
    "max_load": number
  }
]
```

### Create Teacher
```http
POST /api/teachers/
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "name": "string",
  "department_id": number,
  "max_load": number
}

Response: {
  "id": number,
  "name": "string",
  "department_id": number,
  "max_load": number
}
```

---

## 📋 Section Management

### List Sections
```http
GET /api/sections/
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "name": "string",
    "batch": "string",
    "semester": number,
    "department_id": number,
    "strength": number
  }
]
```

### Create Section
```http
POST /api/sections/
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "name": "string",
  "batch": "string",
  "semester": number,
  "department_id": number,
  "strength": number
}

Response: {
  "id": number,
  "name": "string",
  "batch": "string",
  "semester": number,
  "department_id": number,
  "strength": number
}
```

---

## 📅 Timetable Management

### List Timetables
```http
GET /api/timetable/list
Authorization: Bearer <token>

Response: [
  {
    "id": number,
    "name": "string",
    "session_id": number,
    "created_at": "string",
    "is_archived": boolean,
    "semester_info": "string"
  }
]
```

### Get Timetable Details
```http
GET /api/timetable/{timetable_id}
Authorization: Bearer <token>

Response: {
  "id": number,
  "name": "string",
  "session_id": number,
  "created_at": "string",
  "is_archived": boolean,
  "semester_info": "string",
  "class_duration": number,
  "break_slot": number,
  "break_start_time": "string",
  "break_end_time": "string",
  "max_slots_friday": number,
  "slots": [
    {
      "day": number,  // 0=Monday, 1=Tuesday, ..., 4=Friday
      "slot_index": number,  // 0-7
      "section_name": "string",
      "subject_code": "string",
      "teacher_name": "string",
      "lab_engineer_name": "string" | null,
      "room_name": "string",
      "is_lab": boolean,
      "is_break": boolean,
      "label": "string" | null  // For FYP slots
    }
  ]
}
```

### Generate Timetable
```http
POST /api/timetable/generate
Authorization: Bearer <token>
Role: super_admin | program_admin
Content-Type: application/json

{
  "session_id": number,
  "name": "string"
}

Response: {
  "id": number,
  "name": "string",
  "session_id": number,
  "created_at": "string",
  "is_archived": boolean
}

Note: Uses Google OR-Tools constraint programming solver
      to generate conflict-free timetable
```

### Archive Timetable
```http
POST /api/timetable/{timetable_id}/archive
Authorization: Bearer <token>
Role: super_admin | program_admin

Response: {
  "detail": "Timetable archived"
}
```

### Delete Timetable
```http
DELETE /api/timetable/{timetable_id}
Authorization: Bearer <token>
Role: super_admin | program_admin (with can_delete_timetable permission)

Response: {
  "detail": "Timetable deleted"
}
```

---

## 🌐 Public Endpoints (No Authentication Required)

### Get Public Timetables
```http
GET /api/public/timetables

Response: [
  {
    "id": number,
    "name": "string",
    "session_id": number,
    "created_at": "string",
    "semester_info": "string"
  }
]

Note: Only returns non-archived timetables
```

### Get Public Timetable Details
```http
GET /api/public/timetables/{timetable_id}

Response: {
  "id": number,
  "name": "string",
  "session_id": number,
  "created_at": "string",
  "semester_info": "string",
  "class_duration": number,
  "break_slot": number,
  "break_start_time": "string",
  "break_end_time": "string",
  "max_slots_friday": number,
  "slots": [...]
}
```

### Get Public Stats
```http
GET /api/public/stats

Response: {
  "faculty": number,
  "courses": number,
  "departments": number
}
```

---

## 🔒 Authorization Rules

### Role Hierarchy
1. **super_admin**: Full system access
2. **program_admin**: Department-specific access
3. **clerk**: Limited administrative access
4. **teacher**: View-only access

### Endpoint Access Matrix

| Endpoint | super_admin | program_admin | clerk | teacher |
|----------|-------------|---------------|-------|---------|
| User CRUD | ✅ | ❌ | ❌ | ❌ |
| Room CRUD | ✅ | ✅ (dept only) | ❌ | ❌ |
| Department CRUD | ✅ | ❌ | ❌ | ❌ |
| Subject CRUD | ✅ | ✅ (dept only) | ❌ | ❌ |
| Teacher CRUD | ✅ | ✅ (dept only) | ❌ | ❌ |
| Section CRUD | ✅ | ✅ (dept only) | ❌ | ❌ |
| Timetable Generate | ✅ | ✅ (dept only) | ❌ | ❌ |
| Timetable View | ✅ | ✅ | ✅ | ✅ |
| Password Change | ✅ | ✅ | ✅ | ✅ |

---

## 📝 Request Headers

All authenticated requests must include:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "detail": "Error message describing what went wrong"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Not enough permissions"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 🔄 Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting for production deployment.

---

## 📊 Pagination

Currently no pagination is implemented. All list endpoints return all records. Consider adding pagination for large datasets.

---

## 🔍 Filtering & Sorting

### Department Filtering
Most endpoints automatically filter by department based on user role:
- **program_admin**: Only sees their department's data
- **super_admin**: Sees all departments' data

### Sorting
- Users: Sorted by department, then by full_name
- Rooms: Sorted by department_id, then by name
- Other resources: Natural order (by ID)

---

## 🚀 Performance Considerations

1. **Batch Operations**: Use bulk create/delete for rooms
2. **Caching**: Consider implementing Redis for frequently accessed data
3. **Database Indexing**: Ensure proper indexes on foreign keys
4. **Query Optimization**: Use eager loading for related data

---

## 📚 Additional Resources

- **Backend Framework**: FastAPI (https://fastapi.tiangolo.com/)
- **ORM**: SQLAlchemy (https://www.sqlalchemy.org/)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: Bcrypt
- **Constraint Solver**: Google OR-Tools

---

**Version**: 1.0.0
**Base URL**: `http://localhost:8000`
**API Documentation**: `http://localhost:8000/docs` (Swagger UI)
**Last Updated**: Context Transfer Session
