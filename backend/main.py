"""
Main FastAPI entry point.
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import User
from auth import verify_password, create_access_token

# Import routers
from routers import auth, teachers, subjects, assignments, rooms, timetable, departments, public, users, restrictions, dashboard, settings

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Civil Engineering Timetable Portal")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(teachers.router)
app.include_router(subjects.router)
app.include_router(rooms.router)
app.include_router(assignments.router)
app.include_router(timetable.router)
app.include_router(public.router)
app.include_router(users.router)
app.include_router(restrictions.router)
app.include_router(dashboard.router)
app.include_router(settings.router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "CE Timetable API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
