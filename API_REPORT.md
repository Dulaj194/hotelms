# HotelMS API Report

Generated from the FastAPI router definitions in `backend/app` on 2026-03-13.

## Base Information

- Backend base URL: `http://localhost:8000`
- API v1 prefix: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Static uploads: `http://localhost:8000/uploads/...`
- Root endpoint: `GET /`

## Authentication Modes

- `Public`: no auth required.
- `Bearer <access_token>`: staff/admin/super-admin endpoints.
- `refresh_token` cookie: used by `POST /api/v1/auth/refresh`.
- `X-Guest-Session`: signed table guest session token for table cart/order endpoints.
- `X-Room-Session`: signed room guest session token for room cart/order/housekeeping endpoints.
- `WS query token`: `ws://.../api/v1/ws/kitchen/{restaurant_id}?token=<access_jwt>`.

## Summary

- HTTP endpoints implemented: `79`
- WebSocket endpoints implemented: `1`
- Mounted but currently empty route groups: `payments`, `audit-logs`

## Root And Health

Source: `backend/app/main.py`, `backend/app/modules/health/router.py`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | Public | Basic welcome response. |
| GET | `/api/v1/health` | Public | App/DB/Redis health check. |

## Auth

Source: `backend/app/modules/auth/router.py`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | Public | `LoginRequest` | Login and issue access token plus refresh cookie flow. |
| POST | `/api/v1/auth/refresh` | `refresh_token` cookie | - | Refresh access token using cookie-based refresh token. |
| POST | `/api/v1/auth/logout` | Bearer + optional refresh cookie | - | Logout current user and invalidate session/refresh token. |
| POST | `/api/v1/auth/forgot-password` | Public | `ForgotPasswordRequest` | Start password reset flow. |
| POST | `/api/v1/auth/reset-password` | Public | `ResetPasswordRequest` | Reset password with reset token. |
| GET | `/api/v1/auth/me` | Bearer | - | Return current authenticated user profile. |

## Users

Source: `backend/app/modules/users/router.py`

Allowed roles: `owner`, `admin`, `super_admin`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/users` | Bearer | - | List staff for current restaurant. |
| POST | `/api/v1/users` | Bearer | `StaffCreateRequest` | Create a new staff member. |
| GET | `/api/v1/users/{user_id}` | Bearer | - | Get one staff member. |
| PATCH | `/api/v1/users/{user_id}` | Bearer | `StaffUpdateRequest` | Update a staff member. |
| PATCH | `/api/v1/users/{user_id}/disable` | Bearer | - | Disable a staff member. |
| PATCH | `/api/v1/users/{user_id}/enable` | Bearer | - | Re-enable a staff member. |
| DELETE | `/api/v1/users/{user_id}` | Bearer | - | Permanently delete a staff member. |

## Restaurants

Source: `backend/app/modules/restaurants/router.py`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/restaurants/me` | Bearer | - | Get current tenant restaurant profile. |
| PATCH | `/api/v1/restaurants/me` | Bearer (`owner`, `admin`) | `RestaurantUpdateRequest` | Update current tenant restaurant profile. |
| POST | `/api/v1/restaurants/me/logo` | Bearer (`owner`, `admin`) | `multipart/form-data` file upload | Upload or replace restaurant logo. |
| GET | `/api/v1/restaurants` | Bearer (`super_admin`) | - | List all restaurants. |
| POST | `/api/v1/restaurants` | Bearer (`super_admin`) | `RestaurantCreateRequest` | Create a new restaurant tenant. |
| GET | `/api/v1/restaurants/{restaurant_id}` | Bearer (`super_admin`) | - | Get any restaurant by ID. |

## Categories

Source: `backend/app/modules/categories/router.py`

Allowed roles: `owner`, `admin`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/categories` | Bearer | - | List menu categories for current restaurant. |
| POST | `/api/v1/categories` | Bearer | `CategoryCreateRequest` | Create a category. |
| GET | `/api/v1/categories/{category_id}` | Bearer | - | Get one category. |
| PATCH | `/api/v1/categories/{category_id}` | Bearer | `CategoryUpdateRequest` | Update a category. |
| DELETE | `/api/v1/categories/{category_id}` | Bearer | - | Delete a category. |

## Items

Source: `backend/app/modules/items/router.py`

Allowed roles: `owner`, `admin`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/items` | Bearer | - | List menu items for current restaurant. |
| POST | `/api/v1/items` | Bearer | `ItemCreateRequest` | Create a menu item. |
| GET | `/api/v1/items/{item_id}` | Bearer | - | Get one menu item. |
| PATCH | `/api/v1/items/{item_id}` | Bearer | `ItemUpdateRequest` | Update a menu item. |
| DELETE | `/api/v1/items/{item_id}` | Bearer | - | Delete a menu item. |

## Public Guest APIs

Source: `backend/app/modules/public/router.py`

These endpoints are designed for public menu pages and QR flows.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/public/restaurants/{restaurant_id}/info` | Public | Get public restaurant information. |
| GET | `/api/v1/public/restaurants/{restaurant_id}/menu` | Public | Get full public menu tree. |
| GET | `/api/v1/public/restaurants/{restaurant_id}/items/{item_id}` | Public | Get public item detail. |
| GET | `/api/v1/public/restaurants/{restaurant_id}/categories/{category_id}/items` | Public | Get public items for one category. |

## QR

Source: `backend/app/modules/qr/router.py`

Allowed roles: `owner`, `admin`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/qr/table/{table_number}` | Bearer | - | Generate or fetch QR for one table. |
| GET | `/api/v1/qr/room/{room_number}` | Bearer | - | Generate or fetch QR for one room. |
| POST | `/api/v1/qr/tables/bulk` | Bearer | `BulkQRRequest` | Generate QR codes for a table range. |
| POST | `/api/v1/qr/rooms/bulk` | Bearer | `BulkQRRequest` | Generate QR codes for a room range. |

## Table Sessions

Source: `backend/app/modules/table_sessions/router.py`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/table-sessions/start` | Public | `TableSessionStartRequest` | Start table guest session and return signed guest token. |

## Table Cart

Source: `backend/app/modules/cart/router.py`

All endpoints require `X-Guest-Session`.

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/cart` | `X-Guest-Session` | - | Get current table cart. |
| GET | `/api/v1/cart/summary` | `X-Guest-Session` | - | Get lightweight cart summary. |
| POST | `/api/v1/cart/items` | `X-Guest-Session` | `AddCartItemRequest` | Add item to table cart. |
| PATCH | `/api/v1/cart/items/{item_id}` | `X-Guest-Session` | `UpdateCartItemRequest` | Update cart item quantity. |
| DELETE | `/api/v1/cart/items/{item_id}` | `X-Guest-Session` | - | Remove one cart item. |
| DELETE | `/api/v1/cart` | `X-Guest-Session` | - | Clear the entire cart. |

## Orders

Source: `backend/app/modules/orders/router.py`

Guest endpoints require `X-Guest-Session`. Staff endpoints require Bearer role `owner`, `admin`, or `steward`.

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/orders` | `X-Guest-Session` | `PlaceOrderRequest` | Place order from current table cart. |
| GET | `/api/v1/orders/my/{order_id}` | `X-Guest-Session` | - | Get guest's own order detail. |
| GET | `/api/v1/orders/pending` | Bearer staff | - | List pending kitchen orders. |
| GET | `/api/v1/orders/processing` | Bearer staff | - | List confirmed/processing kitchen orders. |
| GET | `/api/v1/orders/completed` | Bearer staff | - | List recently completed kitchen orders. |
| GET | `/api/v1/orders/active` | Bearer staff | - | List all active orders. |
| GET | `/api/v1/orders/history` | Bearer staff | - | List order history. |
| GET | `/api/v1/orders/{order_id}` | Bearer staff | - | Get full order detail for staff. |
| PATCH | `/api/v1/orders/{order_id}/status` | Bearer staff | `UpdateOrderStatusRequest` | Update order status and publish realtime event. |

## Billing

Source: `backend/app/modules/billing/router.py`

Allowed roles: `owner`, `admin`, `steward`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/billing/session/{session_id}/summary` | Bearer staff | - | Get bill summary for a table session. |
| POST | `/api/v1/billing/session/{session_id}/settle` | Bearer staff | `SettleSessionRequest` | Settle and close a table session. |
| GET | `/api/v1/billing/session/{session_id}/payments` | Bearer staff | - | List payment records for a table session. |
| GET | `/api/v1/billing/session/{session_id}/status` | Bearer staff | - | Get quick billing status snapshot. |

## Housekeeping

Source: `backend/app/modules/housekeeping/router.py`

Guest submission uses `X-Room-Session`. Staff management uses Bearer role `owner`, `admin`, or `housekeeper`.

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/housekeeping` | `X-Room-Session` | `HousekeepingRequestCreateRequest` | Submit housekeeping/service request from a room. |
| GET | `/api/v1/housekeeping/history` | Bearer staff | - | List completed housekeeping requests. Supports `room_number` and `request_type` query filters. |
| GET | `/api/v1/housekeeping` | Bearer staff | - | List housekeeping requests. Supports `status`, `room_number`, `request_type` query filters. |
| GET | `/api/v1/housekeeping/{request_id}` | Bearer staff | - | Get one housekeeping request. |
| PATCH | `/api/v1/housekeeping/{request_id}/done` | Bearer staff | - | Mark request as done. |

## Rooms

Source: `backend/app/modules/rooms/router.py`

Allowed roles: `owner`, `admin`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/rooms` | Bearer | - | List rooms in current restaurant. |
| POST | `/api/v1/rooms` | Bearer | `RoomCreateRequest` | Create a room. |
| GET | `/api/v1/rooms/{room_id}` | Bearer | - | Get one room. |
| PATCH | `/api/v1/rooms/{room_id}` | Bearer | `RoomUpdateRequest` | Update a room. |
| PATCH | `/api/v1/rooms/{room_id}/disable` | Bearer | - | Disable a room. |
| PATCH | `/api/v1/rooms/{room_id}/enable` | Bearer | - | Re-enable a room. |
| DELETE | `/api/v1/rooms/{room_id}` | Bearer | - | Delete a room. |

## Room Sessions

Source: `backend/app/modules/room_sessions/router.py`

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/room-sessions/start` | Public | `RoomSessionStartRequest` | Start room guest session and return signed room token. |

## Room Cart

Source: `backend/app/modules/room_sessions/router.py`

All endpoints require `X-Room-Session`.

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/room-cart` | `X-Room-Session` | - | Get current room cart. |
| POST | `/api/v1/room-cart/items` | `X-Room-Session` | `AddRoomCartItemRequest` | Add item to room cart. |
| PATCH | `/api/v1/room-cart/items/{item_id}` | `X-Room-Session` | `UpdateRoomCartItemRequest` | Update room cart item quantity. |
| DELETE | `/api/v1/room-cart/items/{item_id}` | `X-Room-Session` | - | Remove one room cart item. |
| DELETE | `/api/v1/room-cart` | `X-Room-Session` | - | Clear room cart. |

## Room Orders

Source: `backend/app/modules/room_sessions/router.py`

All endpoints require `X-Room-Session`.

| Method | Path | Auth | Body | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/room-orders` | `X-Room-Session` | `PlaceRoomOrderRequest` | Place order from current room cart. |
| GET | `/api/v1/room-orders/{order_id}` | `X-Room-Session` | - | Get current guest's room order detail. |

## Realtime WebSocket

Source: `backend/app/modules/realtime/router.py`

| Type | Path | Auth | Purpose |
| --- | --- | --- | --- |
| WebSocket | `/api/v1/ws/kitchen/{restaurant_id}?token=<access_jwt>` | Query token, roles `owner`, `admin`, `steward` | Kitchen realtime stream for `new_order` and `order_status_updated` events. |

## Stub Route Groups

Source: `backend/app/modules/payments/router.py`, `backend/app/modules/audit_logs/router.py`

- `/api/v1/payments` is mounted, but no HTTP endpoints are implemented yet.
- `/api/v1/audit-logs` is mounted, but no HTTP endpoints are implemented yet.

## Frontend API Usage Notes

Based on the frontend client helpers:

- Default frontend API base URL fallback: `http://localhost:8000/api/v1`
- Staff API helper sends `Authorization: Bearer <token>` and `credentials: include`
- Guest table helper sends `X-Guest-Session`
- Guest room helper sends `X-Room-Session`
