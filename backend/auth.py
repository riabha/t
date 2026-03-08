"""
JWT authentication utilities.
"""
import hashlib
import hmac
import json
import base64
import time
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import User

# Simple secret key (in production use env var)
SECRET_KEY = "ce-timetable-portal-secret-key-2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 86400  # 24 hours

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Simple SHA-256 password hashing."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def create_access_token(data: dict) -> str:
    """Create a simple JWT token."""
    header = _b64encode(json.dumps({"alg": ALGORITHM, "typ": "JWT"}).encode())
    payload_data = {**data, "exp": int(time.time()) + ACCESS_TOKEN_EXPIRE_SECONDS}
    payload = _b64encode(json.dumps(payload_data).encode())
    signature = hmac.new(SECRET_KEY.encode(), f"{header}.{payload}".encode(),
                         hashlib.sha256).digest()
    sig = _b64encode(signature)
    return f"{header}.{payload}.{sig}"


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        expected_sig = _b64encode(
            hmac.new(SECRET_KEY.encode(), f"{header}.{payload}".encode(),
                     hashlib.sha256).digest()
        )
        if not hmac.compare_digest(sig, expected_sig):
            return None
        data = json.loads(_b64decode(payload))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency — extracts and validates the current user from JWT."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated")
    data = decode_token(credentials.credentials)
    if data is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired token")
    user = db.query(User).filter(User.id == data.get("user_id")).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found")
    return user


def require_role(*roles):
    """Dependency factory — require user to have one of the given roles."""
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Insufficient permissions")
        return user
    return checker
