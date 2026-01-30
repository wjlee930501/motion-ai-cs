"""
Authentication utilities for Dashboard API
"""

from datetime import datetime, timedelta
from typing import Optional

import hashlib

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from shared.database import get_db
from shared.models import User
from shared.config import get_settings

settings = get_settings()

# JWT Bearer scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash.

    Also accepts legacy SHA256 hashes for backward compatibility
    during migration period.
    """
    # Try bcrypt first
    try:
        if bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8")):
            return True
    except (ValueError, TypeError):
        pass

    # Fallback: check legacy SHA256 hash for existing accounts
    if hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password:
        return True

    return False


def get_password_hash(password: str) -> str:
    """Generate bcrypt password hash."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid or expired token"}}
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid token payload"}}
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "User not found"}}
        )

    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate user with email and password.

    Auto-upgrades legacy SHA256 hashes to bcrypt on successful login.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None

    # Auto-upgrade legacy SHA256 hash to bcrypt
    if not user.password_hash.startswith("$2b$"):
        user.password_hash = get_password_hash(password)
        db.commit()

    return user


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require admin role for access"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"ok": False, "error": {"code": "FORBIDDEN", "message": "Admin access required"}}
        )
    return current_user
