"""
Cortex — Authentication API endpoints.
Register, login, and forgot-password with SQLite/Postgres persistence.
"""
from __future__ import annotations

import secrets
import smtplib
import string
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.database.connection import get_db
from app.models.domain.user import User
from app.models.schemas.auth import (
    AuthProfileResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
)

log = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ── Password hashing ─────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(plain: str) -> str:
    # bcrypt 4.x throws ValueError if password > 72 bytes.
    # We truncate manually to ensure compatibility.
    return pwd_ctx.hash(plain[:72])


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain[:72], hashed)


def _user_to_profile(user: User) -> dict:
    """Convert a User ORM instance to a dict matching AuthProfileResponse."""
    return {
        "id": user.id,
        "name": user.display_name,
        "email": user.email or "",
        "phone": user.phone or "",
        "gender": user.gender or "",
        "location": user.location or "",
        "college": user.college or "",
        "degree": user.degree or "",
        "course": user.course or "",
        "user_type": user.user_type or "Student",
        "year_of_study": user.year_of_study or "",
        "plan": user.plan or "free",
    }


# ── Email helper ──────────────────────────────────────────────────────────────
def _send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        log.warning("smtp.not_configured", to=to, body=body)
        return False

    sender = settings.SMTP_FROM or settings.SMTP_USER
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender, [to], msg.as_string())
        log.info("smtp.sent", to=to)
        return True
    except Exception as exc:
        log.error("smtp.send_failed", to=to, error=str(exc))
        return False


# ── POST /auth/register ──────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=AuthProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Check duplicate phone
    existing_phone = await db.execute(select(User).where(User.phone == body.phone))
    if existing_phone.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists.",
        )

    user = User(
        id=str(uuid.uuid4()),
        display_name=body.name,
        email=body.email,
        password_hash=_hash_password(body.password),
        phone=body.phone,
        gender=body.gender,
        location=body.location,
        college=body.college,
        degree=body.degree,
        course=body.course,
        user_type=body.user_type,
        year_of_study=body.year_of_study,
    )
    db.add(user)
    await db.flush()

    log.info("auth.register_success", user_id=user.id, email=user.email)
    return _user_to_profile(user)


# ── POST /auth/login ─────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=AuthProfileResponse,
    summary="Log in with email and password",
)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not _verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    log.info("auth.login_success", user_id=user.id, email=user.email)
    return _user_to_profile(user)


# ── POST /auth/forgot-password ───────────────────────────────────────────────
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Reset password — generates a random 10-char password and emails it",
)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email.",
        )

    # Generate a random 10-character password
    alphabet = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(10))

    # Update DB with hashed version
    user.password_hash = _hash_password(temp_password)
    await db.flush()

    # Send email (or log if SMTP is not configured)
    email_sent = _send_email(
        to=user.email,
        subject="Cortex — Your Temporary Password",
        body=(
            f"Hello {user.display_name},\n\n"
            f"Your temporary password is:  {temp_password}\n\n"
            "Please log in with this password and change it immediately.\n\n"
            "— Team Cortex"
        ),
    )

    if email_sent:
        log.info("auth.forgot_password_email_sent", email=user.email)
        return {"message": "A temporary password has been sent to your email. Please check your inbox."}
    else:
        # SMTP not configured — log the password for dev use
        log.warning(
            "auth.forgot_password_no_smtp",
            email=user.email,
            temp_password=temp_password,
        )
        return {
            "message": (
                f"SMTP not configured. Your temporary password is: {temp_password}  "
                "(In production, this would be emailed to you.)"
            )
        }
