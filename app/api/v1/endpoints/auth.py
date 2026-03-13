"""
Cortex — Authentication API endpoints.
Register, login, forgot-password (OTP), and reset-password.

Security hardening (2026-03-11):
  - Rate-limited via slowapi (login 10/min, register 5/min, reset 3/min)
  - Token-based OTP reset (8-char, 15-min expiry) — no raw passwords in responses/logs
  - Email enumeration prevention: forgot-password always returns 200
  - Structured audit logging with IP address
  - must_change_password flag enforced on forced resets
"""
from __future__ import annotations

import secrets
import smtplib
import string
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import get_logger
from app.database.connection import get_db
from app.models.domain.user import PasswordResetToken, User
from app.models.schemas.auth import (
    AuthProfileResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.sync_engine.event_store import record_event
from app.models.schemas.sync import SyncEventCreate

log = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ── Password hashing ─────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Allowed characters for OTP (no ambiguous chars like 0/O, 1/I/l)
_OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain[:72])


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain[:72], hashed)


def _generate_otp(length: int = 8) -> str:
    """Generate a cryptographically secure OTP using an unambiguous alphabet."""
    return "".join(secrets.choice(_OTP_ALPHABET) for _ in range(length))


def _user_to_profile(user: User) -> dict:
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
        "must_change_password": user.must_change_password,
    }


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Email helpers ─────────────────────────────────────────────────────────────
def _generate_reset_email_html(name: str, otp: str) -> str:
    """
    Generate a beautiful HTML email template for password reset that matches Cortex branding.
    """
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cortex Password Reset</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}

            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #374151;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
            }}

            .email-container {{
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                overflow: hidden;
            }}

            .header {{
                background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                padding: 40px 30px;
                text-align: center;
                position: relative;
            }}

            .header::before {{
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>') center/cover;
                opacity: 0.3;
            }}

            .logo {{
                position: relative;
                z-index: 1;
                color: #ffffff;
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
                letter-spacing: -0.5px;
            }}

            .tagline {{
                position: relative;
                z-index: 1;
                color: rgba(255, 255, 255, 0.9);
                font-size: 16px;
                font-weight: 500;
            }}

            .content {{
                padding: 50px 30px;
            }}

            .greeting {{
                font-size: 24px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 20px;
            }}

            .message {{
                font-size: 16px;
                color: #6b7280;
                margin-bottom: 40px;
                line-height: 1.7;
            }}

            .otp-container {{
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 2px dashed #6366f1;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin: 40px 0;
                position: relative;
            }}

            .otp-label {{
                font-size: 14px;
                font-weight: 600;
                color: #6366f1;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
            }}

            .otp-code {{
                font-family: 'JetBrains Mono', 'Courier New', monospace;
                font-size: 36px;
                font-weight: 700;
                color: #111827;
                letter-spacing: 8px;
                margin: 0;
                padding: 15px 20px;
                background: #ffffff;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                display: inline-block;
                user-select: all;
            }}

            .otp-note {{
                font-size: 13px;
                color: #9ca3af;
                margin-top: 12px;
                font-style: italic;
            }}

            .instructions {{
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 20px 25px;
                margin: 30px 0;
                border-radius: 0 8px 8px 0;
            }}

            .instructions-title {{
                font-size: 16px;
                font-weight: 600;
                color: #92400e;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }}

            .instructions-text {{
                font-size: 14px;
                color: #78350f;
                line-height: 1.6;
            }}

            .security-note {{
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 8px;
                padding: 20px;
                margin: 30px 0;
                text-align: center;
            }}

            .security-note-text {{
                font-size: 14px;
                color: #0c4a6e;
                line-height: 1.6;
            }}

            .footer {{
                background: #f9fafb;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
            }}

            .team-signature {{
                font-size: 16px;
                font-weight: 600;
                color: #4f46e5;
                margin-bottom: 8px;
            }}

            .team-subtitle {{
                font-size: 14px;
                color: #6b7280;
                margin-bottom: 20px;
            }}

            .social-links {{
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-top: 20px;
            }}

            .social-link {{
                display: inline-block;
                width: 40px;
                height: 40px;
                background: #6366f1;
                border-radius: 50%;
                color: white;
                text-decoration: none;
                font-size: 18px;
                line-height: 40px;
                transition: all 0.2s ease;
            }}

            .social-link:hover {{
                background: #4f46e5;
                transform: translateY(-2px);
            }}

            @media (max-width: 600px) {{
                .email-container {{
                    margin: 10px;
                    border-radius: 8px;
                }}

                .header {{
                    padding: 30px 20px;
                }}

                .content {{
                    padding: 30px 20px;
                }}

                .logo {{
                    font-size: 28px;
                }}

                .otp-code {{
                    font-size: 28px;
                    letter-spacing: 4px;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">Cortex</div>
                <div class="tagline">Your AI-Powered Second Brain</div>
            </div>

            <div class="content">
                <div class="greeting">Hello {name}! 👋</div>

                <div class="message">
                    You've requested a password reset for your Cortex account. We've generated a secure verification code for you.
                </div>

                <div class="otp-container">
                    <div class="otp-label">Your Reset Code</div>
                    <div class="otp-code">{otp}</div>
                    <div class="otp-note">Click to select and copy</div>
                </div>

                <div class="instructions">
                    <div class="instructions-title">
                        ⚡ Quick Steps
                    </div>
                    <div class="instructions-text">
                        1. Copy the code above<br>
                        2. Return to the Cortex app<br>
                        3. Paste the code and set your new password<br>
                        4. You're all set! 🚀
                    </div>
                </div>

                <div class="security-note">
                    <div class="security-note-text">
                        <strong>🔒 Security Notice:</strong> This code expires in <strong>15 minutes</strong> for your protection.
                        If you didn't request this reset, you can safely ignore this email — your account remains secure.
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="team-signature">Team Cortex</div>
                <div class="team-subtitle">Building the future of offline-first AI</div>
            </div>
        </div>
    </body>
    </html>
    """


def _send_reset_email(to: str, name: str, otp: str) -> bool:
    """
    Send the OTP reset code via SMTP with beautiful HTML and plain text versions.
    Returns True on success, False if SMTP is not configured.
    NEVER logs or returns the OTP itself in structured logs.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    sender = settings.SMTP_FROM or settings.SMTP_USER
    subject = "🔐 Cortex — Your Password Reset Code"

    # Plain text version (fallback)
    text_body = (
        f"Hello {name},\n\n"
        f"Your Cortex password reset code is:\n\n"
        f"    {otp}\n\n"
        f"This code expires in 15 minutes.\n"
        f"Enter it in the Cortex app to set a new password.\n\n"
        f"If you did not request this, ignore this email — your account is safe.\n\n"
        f"— Team Cortex\n"
        f"Your AI-Powered Second Brain"
    )

    # Beautiful HTML version
    html_body = _generate_reset_email_html(name, otp)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    # Attach both plain text and HTML versions for maximum compatibility
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender, [to], msg.as_string())
        log.info("smtp.reset_email_sent", to=to)
        return True
    except Exception as exc:
        log.error("smtp.reset_email_failed", to=to, error=str(exc))
        return False


# ── POST /auth/register ──────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=AuthProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    ip = _get_client_ip(request)

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalars().first():
        log.warning("auth.register_duplicate_email", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    existing_phone = await db.execute(select(User).where(User.phone == body.phone))
    if existing_phone.scalars().first():
        log.warning("auth.register_duplicate_phone", ip=ip)
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
        must_change_password=False,
    )
    db.add(user)
    await db.flush()

    try:
        await record_event(
            SyncEventCreate(
                device_id="local-reg",
                entity_type="user",
                entity_id=user.id,
                operation="create",
                payload=_user_to_profile(user),
                vector_clock={},
            ),
            db,
        )
    except Exception as exc:
        log.warning("auth.sync_event_failed", error=str(exc))

    log.info("auth.register_success", user_id=user.id, ip=ip)
    return _user_to_profile(user)


# ── POST /auth/login ─────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=AuthProfileResponse,
    summary="Log in with email and password",
)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = _get_client_ip(request)
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    if not user or not _verify_password(body.password, user.password_hash):
        log.warning("auth.login_failed", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    log.info("auth.login_success", user_id=user.id, ip=ip)
    return _user_to_profile(user)


# ── POST /auth/forgot-password ───────────────────────────────────────────────
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset OTP — always returns 200 to prevent email enumeration",
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    ip = _get_client_ip(request)

    # Always return the same generic 200 — never reveal whether email exists (OWASP A07)
    GENERIC_MSG = (
        "If this email is registered, you will receive a reset code shortly. "
        "Check your inbox (and spam folder). The code expires in 15 minutes."
    )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()

    if not user:
        # Log the attempt for audit trail but return 200 to prevent enumeration
        log.info("auth.reset_requested_unknown_email", ip=ip)
        return {"message": GENERIC_MSG}

    # Invalidate all prior unused tokens for this user
    await db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        )
    )

    # Generate OTP and store with 15-min expiry
    otp = _generate_otp(8)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    token_obj = PasswordResetToken(
        token=otp,
        user_id=user.id,
        expires_at=expires,
        used=False,
    )
    db.add(token_obj)
    await db.flush()

    # Attempt SMTP delivery
    email_sent = _send_reset_email(to=user.email, name=user.display_name, otp=otp)

    if email_sent:
        log.info("auth.reset_otp_sent", user_id=user.id, ip=ip)
    else:
        # SMTP not configured: print OTP to server console ONLY (never to structured logs / response)
        # Remove this print block before production deployment.
        import sys
        print(  # noqa: T201
            f"\n[DEV ONLY — REMOVE IN PROD] Reset OTP for {user.email}: {otp}\n",
            file=sys.stderr,
        )
        log.warning("auth.reset_otp_smtp_not_configured", user_id=user.id, ip=ip)

    return {"message": GENERIC_MSG}


# ── POST /auth/reset-password ────────────────────────────────────────────────
@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete password reset using the OTP from email",
)
@limiter.limit("5/minute")
async def reset_password(
    request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    ip = _get_client_ip(request)
    otp = body.token.upper().strip()

    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == otp)
    )
    token_obj = result.scalars().first()

    now = datetime.now(timezone.utc)

    if not token_obj:
        log.warning("auth.reset_invalid_token", ip=ip)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    if token_obj.used:
        log.warning("auth.reset_token_already_used", ip=ip, user_id=token_obj.user_id)
        raise HTTPException(status_code=400, detail="This reset code has already been used.")

    # Compare timezone-aware vs naive — normalise to UTC
    expires_at = token_obj.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        log.warning("auth.reset_token_expired", ip=ip, user_id=token_obj.user_id)
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    # Fetch the user
    user_result = await db.execute(select(User).where(User.id == token_obj.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    # Update password and clear the must_change flag
    user.password_hash = _hash_password(body.new_password)
    user.must_change_password = False

    # Mark token as used (never delete — keep for audit trail)
    token_obj.used = True

    log.info("auth.reset_success", user_id=user.id, ip=ip)
    return {"message": "Password reset successfully. You can now log in with your new password."}
