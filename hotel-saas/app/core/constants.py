"""
Global Constants
Non-sensitive configuration constants shared across application
"""

# HTTP Status Codes
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_NO_CONTENT = 204
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_UNPROCESSABLE = 422
HTTP_TOO_MANY_REQUESTS = 429
HTTP_INTERNAL_ERROR = 500
HTTP_SERVICE_UNAVAILABLE = 503

# Roles
ROLE_SUPER_ADMIN = "super_admin"
ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_STEWARD = "steward"
ROLE_HOUSEKEEPER = "housekeeper"

VALID_ROLES = [
    ROLE_SUPER_ADMIN,
    ROLE_OWNER,
    ROLE_ADMIN,
    ROLE_STEWARD,
    ROLE_HOUSEKEEPER,
]

# Entity Types (for audit logs, field permissions)
ENTITY_TYPES = [
    "restaurant",
    "admin",
    "category",
    "food_item",
    "order_header",
    "order_item",
    "payment",
    "room",
    "housekeeping_task",
    "invoice",
    "media",
]

# Field Access Levels
ACCESS_HIDDEN = "hidden"
ACCESS_VIEW_ONLY = "view_only"
ACCESS_EDIT = "edit"
ACCESS_ADMIN = "admin"

VALID_ACCESS_LEVELS = [
    ACCESS_HIDDEN,
    ACCESS_VIEW_ONLY,
    ACCESS_EDIT,
    ACCESS_ADMIN,
]

# Order Status
ORDER_STATUS = {
    "pending": "Pending",
    "confirmed": "Confirmed",
    "preparing": "Preparing",
    "ready": "Ready",
    "served": "Served",
    "cancelled": "Cancelled",
}

# Payment Status
PAYMENT_STATUS = {
    "pending": "Pending",
    "partial": "Partial",
    "paid": "Paid",
    "failed": "Failed",
    "refunded": "Refunded",
}

# Subscription Status
SUBSCRIPTION_STATUS = {
    "trial": "Trial",
    "active": "Active",
    "paused": "Paused",
    "expired": "Expired",
    "cancelled": "Cancelled",
}

# File Upload Limits
FILE_UPLOAD = {
    "max_size": 5 * 1024 * 1024,  # 5MB
    "max_images": 5,
    "allowed_types": {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
    },
    "min_width": 100,
    "min_height": 100,
    "max_width": 2000,
    "max_height": 2000,
}

# Pagination
PAGINATION = {
    "default_limit": 50,
    "max_limit": 1000,
    "default_page": 1,
}

# Rate Limiting
RATE_LIMITS = {
    "login": {"limit": 5, "window": 900},  # 5 per 15 minutes
    "register": {"limit": 3, "window": 3600},  # 3 per hour
    "password_reset": {"limit": 3, "window": 3600},  # 3 per hour
    "file_upload": {"limit": 10, "window": 3600},  # 10 per hour
    "api_default": {"limit": 100, "window": 60},  # 100 per minute
}

# Cache TTL (seconds)
CACHE_TTL = {
    "restaurant_settings": 3600,
    "permissions": 1800,
    "field_definitions": 3600,
}

# Logging
LOG_LEVELS = {
    "DEBUG": 10,
    "INFO": 20,
    "WARNING": 30,
    "ERROR": 40,
    "CRITICAL": 50,
}

# Date/Time Formats
DATE_FORMAT = "%Y-%m-%d"
DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
ISO_DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
