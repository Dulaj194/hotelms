"""Domain-specific exception hierarchy for HotelMS.

All domain exceptions inherit from HotelMSException.
HTTP handlers convert these to appropriate status codes via exception handlers in main.py.
"""
from typing import Any


class HotelMSException(Exception):
    """Base exception for all HotelMS domain errors.
    
    Attributes:
        status_code: HTTP status code to return
        detail: Error message for client
        error_code: Machine-readable error code
        extra: Additional context data
    """
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    
    def __init__(
        self,
        detail: str,
        status_code: int | None = None,
        error_code: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.detail = detail
        self.status_code = status_code or self.__class__.status_code
        self.error_code = error_code or self.__class__.error_code
        self.extra = extra or {}
        super().__init__(detail)


# AUTHENTICATION & AUTHORIZATION ERRORS (401-403)

class AuthenticationException(HotelMSException):
    """Authentication failed (invalid credentials, missing auth, expired token)."""
    status_code = 401
    error_code = "AUTHENTICATION_FAILED"


class InvalidCredentialsException(AuthenticationException):
    """Invalid username, password, or credentials."""
    error_code = "INVALID_CREDENTIALS"


class TokenExpiredException(AuthenticationException):
    """JWT token has expired."""
    error_code = "TOKEN_EXPIRED"


class InvalidTokenException(AuthenticationException):
    """JWT token is invalid or malformed."""
    error_code = "INVALID_TOKEN"


class MissingAuthorizationException(AuthenticationException):
    """Missing Authorization header or credentials."""
    error_code = "MISSING_AUTHORIZATION"


class AuthorizationException(HotelMSException):
    """User lacks permission for requested resource (403)."""
    status_code = 403
    error_code = "AUTHORIZATION_FAILED"


class InsufficientPrivilegesException(AuthorizationException):
    """User role does not have required privileges."""
    error_code = "INSUFFICIENT_PRIVILEGES"


class RoleRequiredException(AuthorizationException):
    """Specific role is required to access resource."""
    error_code = "ROLE_REQUIRED"


# TENANT & CONTEXT ERRORS (403)

class TenantException(HotelMSException):
    """Tenant isolation or context violation."""
    status_code = 403
    error_code = "TENANT_VIOLATION"


class TenantContextMissingException(TenantException):
    """Request requires tenant context but none was provided."""
    error_code = "TENANT_CONTEXT_MISSING"


class TenantContextMismatchException(TenantException):
    """User's tenant context doesn't match requested resource."""
    error_code = "TENANT_MISMATCH"


class InvalidTenantException(TenantException):
    """Tenant ID is invalid or inactive."""
    error_code = "INVALID_TENANT"


class TenantAccessDeniedException(TenantException):
    """Access denied to this tenant."""
    error_code = "TENANT_ACCESS_DENIED"


# VALIDATION ERRORS (400)

class ValidationException(HotelMSException):
    """Input validation failed."""
    status_code = 400
    error_code = "VALIDATION_ERROR"


class InvalidRequestException(ValidationException):
    """Request body or parameters are invalid."""
    error_code = "INVALID_REQUEST"


class DuplicateException(ValidationException):
    """Resource already exists (duplicate key violation)."""
    error_code = "DUPLICATE_RESOURCE"


class ConstraintViolationException(ValidationException):
    """Database constraint was violated."""
    error_code = "CONSTRAINT_VIOLATION"


class InvalidEnumException(ValidationException):
    """Invalid enum value provided."""
    error_code = "INVALID_ENUM_VALUE"


class InvalidStatusTransitionException(ValidationException):
    """Requested state transition is not allowed."""
    error_code = "INVALID_STATUS_TRANSITION"


# RATE LIMITING (429)

class RateLimitException(HotelMSException):
    """Rate limit exceeded."""
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"


class LoginRateLimitException(RateLimitException):
    """Too many login attempts from this IP."""
    error_code = "LOGIN_RATE_LIMIT"


class RegistrationRateLimitException(RateLimitException):
    """Too many registration attempts from this IP."""
    error_code = "REGISTRATION_RATE_LIMIT"


class PasswordResetRateLimitException(RateLimitException):
    """Too many password reset attempts from this IP."""
    error_code = "PASSWORD_RESET_RATE_LIMIT"


# NOT FOUND ERRORS (404)

class NotFoundException(HotelMSException):
    """Requested resource not found."""
    status_code = 404
    error_code = "NOT_FOUND"


class ResourceNotFoundException(NotFoundException):
    """Specific resource not found."""
    error_code = "RESOURCE_NOT_FOUND"


class UserNotFoundException(NotFoundException):
    """User not found."""
    error_code = "USER_NOT_FOUND"


class RestaurantNotFoundException(NotFoundException):
    """Restaurant not found."""
    error_code = "RESTAURANT_NOT_FOUND"


class OrderNotFoundException(NotFoundException):
    """Order not found."""
    error_code = "ORDER_NOT_FOUND"


# BUSINESS LOGIC ERRORS (422)

class BusinessLogicException(HotelMSException):
    """Business rule violation (unprocessable entity)."""
    status_code = 422
    error_code = "BUSINESS_LOGIC_ERROR"


class PaymentProcessingException(BusinessLogicException):
    """Payment processing failed."""
    error_code = "PAYMENT_PROCESSING_FAILED"


class SubscriptionException(BusinessLogicException):
    """Subscription operation failed."""
    error_code = "SUBSCRIPTION_ERROR"


class BillingException(BusinessLogicException):
    """Billing operation failed."""
    error_code = "BILLING_ERROR"


class OrderProcessingException(BusinessLogicException):
    """Order processing failed."""
    error_code = "ORDER_PROCESSING_FAILED"


# EXTERNAL SERVICE ERRORS (502-503)

class ExternalServiceException(HotelMSException):
    """External service call failed."""
    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"


class EmailServiceException(ExternalServiceException):
    """Email service failed."""
    error_code = "EMAIL_SERVICE_FAILED"


class SMSServiceException(ExternalServiceException):
    """SMS service failed."""
    error_code = "SMS_SERVICE_FAILED"


class PaymentGatewayException(ExternalServiceException):
    """Payment gateway error."""
    error_code = "PAYMENT_GATEWAY_ERROR"


class RedisException(ExternalServiceException):
    """Redis service error."""
    error_code = "REDIS_ERROR"
    status_code = 503  # Service unavailable


# CONFIGURATION ERRORS (500)

class ConfigurationException(HotelMSException):
    """Configuration is invalid or missing."""
    status_code = 500
    error_code = "CONFIGURATION_ERROR"


class MissingConfigurationException(ConfigurationException):
    """Required configuration is missing."""
    error_code = "MISSING_CONFIGURATION"


class InvalidConfigurationException(ConfigurationException):
    """Configuration value is invalid."""
    error_code = "INVALID_CONFIGURATION"


# DATABASE ERRORS (500)

class DatabaseException(HotelMSException):
    """Database operation failed."""
    status_code = 500
    error_code = "DATABASE_ERROR"


class TransactionException(DatabaseException):
    """Database transaction failed."""
    error_code = "TRANSACTION_FAILED"


class DeadlockException(DatabaseException):
    """Database deadlock detected."""
    error_code = "DATABASE_DEADLOCK"


class IntegrityException(DatabaseException):
    """Database integrity check failed."""
    error_code = "DATA_INTEGRITY_ERROR"


# IDEMPOTENCY ERRORS (400-409)

class IdempotencyException(HotelMSException):
    """Idempotency key handling error."""
    status_code = 400
    error_code = "IDEMPOTENCY_ERROR"


class DuplicateIdempotencyKeyException(IdempotencyException):
    """Idempotency key was used before with different request."""
    status_code = 409
    error_code = "IDEMPOTENCY_KEY_CONFLICT"


# FILE OPERATION ERRORS (400-413)

class FileOperationException(HotelMSException):
    """File operation failed."""
    status_code = 400
    error_code = "FILE_OPERATION_FAILED"


class FileSizeExceededException(FileOperationException):
    """Uploaded file exceeds size limit."""
    status_code = 413
    error_code = "FILE_TOO_LARGE"


class InvalidFileTypeException(FileOperationException):
    """File type is not allowed."""
    error_code = "INVALID_FILE_TYPE"


class FilePathTraversalException(FileOperationException):
    """Attempted directory traversal in file path."""
    error_code = "FILE_PATH_TRAVERSAL"


# WEBSOCKET ERRORS

class WebSocketException(HotelMSException):
    """WebSocket connection or message error."""
    status_code = 400
    error_code = "WEBSOCKET_ERROR"


class WebSocketAuthenticationException(WebSocketException):
    """WebSocket authentication failed."""
    error_code = "WEBSOCKET_AUTH_FAILED"


class WebSocketMessageException(WebSocketException):
    """Invalid WebSocket message format."""
    error_code = "INVALID_WEBSOCKET_MESSAGE"
