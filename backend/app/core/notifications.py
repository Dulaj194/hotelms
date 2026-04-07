from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def send_onboarding_email(
    *,
    recipient_email: str,
    recipient_name: str,
    restaurant_name: str,
    temporary_password: str,
) -> bool:
    """Send onboarding credentials email for first login.

    Returns True if sent successfully. Returns False on failure and logs details.
    """
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning(
            "Onboarding email not sent: SMTP not configured. recipient=%s restaurant=%s temp_password=%s",
            recipient_email,
            restaurant_name,
            temporary_password,
        )
        return False

    subject = "HotelMS Access Created — First Login Required"
    body = (
        f"Hello {recipient_name},\n\n"
        f"Your admin access for '{restaurant_name}' has been created successfully.\n\n"
        "Login URL:\n"
        f"{settings.frontend_login_url}\n\n"
        "Use these credentials for first login:\n"
        f"Email: {recipient_email}\n"
        f"Temporary Password: {temporary_password}\n\n"
        "On first login, you must change your password.\n\n"
        "Thanks,\n"
        "HotelMS Team\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = recipient_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning(
            "Failed to send onboarding email to %s: %s",
            recipient_email,
            exc,
        )
        return False


def send_temporary_password_reset_email(
    *,
    recipient_email: str,
    recipient_name: str,
    restaurant_name: str,
    temporary_password: str,
) -> bool:
    """Send temporary password after super-admin initiated reset.

    Returns True if sent successfully. Returns False on failure and logs details.
    """
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning(
            "Password reset email not sent: SMTP not configured. recipient=%s restaurant=%s temp_password=%s",
            recipient_email,
            restaurant_name,
            temporary_password,
        )
        return False

    subject = "HotelMS Password Reset — Temporary Password Issued"
    body = (
        f"Hello {recipient_name},\n\n"
        f"Your password for '{restaurant_name}' has been reset by a super admin.\n\n"
        "Login URL:\n"
        f"{settings.frontend_login_url}\n\n"
        "Use this temporary password to sign in:\n"
        f"Email: {recipient_email}\n"
        f"Temporary Password: {temporary_password}\n\n"
        "You must change this password immediately after login.\n\n"
        "If you did not request this, contact your platform administrator.\n\n"
        "Thanks,\n"
        "HotelMS Team\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = recipient_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning(
            "Failed to send password reset email to %s: %s",
            recipient_email,
            exc,
        )
        return False
