import i18n from '@/i18n/config';

/**
 * Senior Software Engineer Approach:
 * Maps raw backend error detail strings to localization keys defined in errors.json.
 * This avoids tight coupling between backend strings and frontend UI while 
 * providing a seamless localized experience.
 */
export function translateError(detail: string): string {
  if (!detail) return i18n.t('errors:generic_error');

  // Exact matches
  const exactMappings: Record<string, string> = {
    "Item not found.": "item_not_found",
    "Add items before applying a coupon.": "cart_empty_coupon",
    "Invalid or expired access token.": "invalid_access_token",
    "Invalid token type.": "invalid_token_type",
    "User not found.": "user_not_found",
    "Account is inactive.": "account_inactive",
    "Your restaurant account is unavailable.": "restaurant_unavailable",
    "Your registration is pending super admin approval.": "registration_pending",
    "Your registration was rejected. Please contact support.": "registration_rejected",
    "Your restaurant account is inactive.": "restaurant_inactive",
    "Password change required before accessing this resource.": "password_change_required",
    "You do not have permission to perform this action.": "permission_denied",
    "No restaurant context available.": "no_restaurant_context",
    "An active subscription is required for this feature.": "active_subscription_required",
    "Invalid or expired guest session.": "invalid_guest_session",
    "Invalid or expired room session.": "invalid_room_session",
    "Unable to connect to the server. Please check backend service and try again.": "unable_to_connect"
  };

  if (exactMappings[detail]) {
    return i18n.t(`errors:${exactMappings[detail]}`);
  }

  // Pattern matches (e.g. "'Mixed Rice' is currently unavailable.")
  if (detail.includes("is currently unavailable")) {
    return i18n.t('errors:item_unavailable');
  }

  // Fallback: if it's already localized or unknown, return as is (but try to catch common ones)
  return detail;
}
