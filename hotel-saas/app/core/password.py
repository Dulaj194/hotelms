"""
Password Security Utilities
BCRYPT hashing and verification
"""

from passlib.context import CryptContext
import re

# BCRYPT context with cost 12 (slow down brute force)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


class PasswordService:
    """Password hashing and verification service"""

    # Password requirements
    MIN_LENGTH = 8
    MAX_LENGTH = 255
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGITS = True
    REQUIRE_SPECIAL = True

    @staticmethod
    def hash(password: str) -> str:
        """
        Hash password with BCRYPT

        Args:
            password: Plain text password

        Returns:
            BCRYPT hash
        """
        return pwd_context.hash(password)

    @staticmethod
    def verify(plain_password: str, hashed_password: str) -> bool:
        """
        Verify password against hash

        Args:
            plain_password: Plain text password to verify
            hashed_password: BCRYPT hash to check against

        Returns:
            True if password matches, False otherwise
        """
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    @staticmethod
    def needs_rehash(hashed_password: str) -> bool:
        """
        Check if hash needs to be updated (cost changed)

        Args:
            hashed_password: Current BCRYPT hash

        Returns:
            True if hash should be regenerated
        """
        return pwd_context.needs_update(hashed_password)

    @staticmethod
    def is_strong(password: str) -> tuple[bool, list[str]]:
        """
        Validate password strength

        Args:
            password: Password to validate

        Returns:
            Tuple of (is_valid, [error_messages])
        """
        errors = []

        # Length check
        if len(password) < PasswordService.MIN_LENGTH:
            errors.append(f"Password must be at least {PasswordService.MIN_LENGTH} characters")
        if len(password) > PasswordService.MAX_LENGTH:
            errors.append(f"Password must not exceed {PasswordService.MAX_LENGTH} characters")

        # Uppercase check
        if PasswordService.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")

        # Lowercase check
        if PasswordService.REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")

        # Digit check
        if PasswordService.REQUIRE_DIGITS and not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")

        # Special character check
        if PasswordService.REQUIRE_SPECIAL and not re.search(r"[@$!%*?&\-_=+]", password):
            errors.append("Password must contain at least one special character (@$!%*?&-_=+)")

        return len(errors) == 0, errors
