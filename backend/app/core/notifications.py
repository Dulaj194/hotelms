from __future__ import annotations

import re
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _normalize_phone_for_sms(phone_number: str) -> str:
    normalized = re.sub(r"[^\d+]", "", phone_number.strip())
    if not normalized:
        return ""
    if normalized.startswith("+"):
        return normalized

    digits = re.sub(r"\D", "", normalized)
    if not digits:
        return ""

    if settings.sms_default_country_code:
        country_code = settings.sms_default_country_code.strip()
        if not country_code.startswith("+"):
            country_code = f"+{country_code}"
        if digits.startswith("0"):
            digits = digits[1:]
        return f"{country_code}{digits}"

    # If no country code is configured, try E.164-like formatting.
    return f"+{digits}"


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


def send_registration_approved_email(
    *,
    recipient_email: str,
    recipient_name: str,
    restaurant_name: str,
    review_notes: str | None = None,
) -> bool:
    """Send registration approval email to the hotel owner/admin contact."""
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning(
            "Registration approval email not sent: SMTP not configured. recipient=%s restaurant=%s",
            recipient_email,
            restaurant_name,
        )
        return False

    review_notes_text = (
        f"\nReview notes: {review_notes}\n"
        if review_notes
        else "\n"
    )
    subject = "HotelMS Registration Approved"
    body = (
        f"Hello {recipient_name},\n\n"
        f"Great news. Your hotel registration for '{restaurant_name}' has been approved by super admin.\n"
        f"{review_notes_text}\n"
        "You can now sign in using your registered email and password:\n"
        f"{settings.frontend_login_url}\n\n"
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
            "Failed to send registration approval email to %s: %s",
            recipient_email,
            exc,
        )
        return False


def send_registration_approved_sms(
    *,
    recipient_phone: str,
    restaurant_name: str,
) -> bool:
    """Send registration approval SMS using the configured SMS provider."""
    if not settings.sms_enabled:
        return False

    if settings.sms_provider.strip().lower() != "twilio":
        logger.warning(
            "Registration approval SMS not sent: unsupported SMS provider '%s'.",
            settings.sms_provider,
        )
        return False

    if (
        not settings.twilio_account_sid
        or not settings.twilio_auth_token
        or not settings.twilio_from_number
    ):
        logger.warning(
            "Registration approval SMS not sent: Twilio credentials are not configured."
        )
        return False

    to_number = _normalize_phone_for_sms(recipient_phone)
    if not to_number:
        logger.warning(
            "Registration approval SMS not sent: invalid recipient phone '%s'.",
            recipient_phone,
        )
        return False

    from_number = settings.twilio_from_number.strip()
    if to_number == from_number:
        logger.warning(
            "Registration approval SMS not sent: recipient and sender numbers cannot be identical (%s).",
            to_number,
        )
        return False

    sms_body = (
        f"HotelMS: '{restaurant_name}' registration approved. "
        f"Login: {settings.frontend_login_url}"
    )

    try:
        response = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
            data={
                "To": to_number,
                "From": from_number,
                "Body": sms_body,
            },
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=20.0,
        )
        if 200 <= response.status_code < 300:
            return True

        logger.warning(
            "Failed to send registration approval SMS to %s: status=%s body=%s",
            to_number,
            response.status_code,
            response.text[:500],
        )
        return False
    except Exception as exc:
        logger.warning(
            "Failed to send registration approval SMS to %s: %s",
            to_number,
            exc,
        )
        return False
