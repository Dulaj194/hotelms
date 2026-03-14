# Super Admin Report (HotelMS)

Date: 2026-03-14

## Scope checked
- Backend role model and role-based dependencies
- Frontend login redirect and protected route guards
- Super admin restaurant management entry points

## Verified architecture
- This repository is FastAPI + React/Vite.
- Super admin role value in current system is `super_admin` (legacy alias `s_admin` now normalized in frontend).
- Super admin restaurant management API is implemented in `/api/v1/restaurants` endpoints guarded with `require_roles("super_admin")`.

## Fixes applied now
1. Frontend role alias normalization
   - Added role normalization function so `s_admin` maps to `super_admin`.
   - Applied to role redirect and route authorization checks.

2. Route guard matrix corrected
   - Admin routes in `App.tsx` were overly restricted to only `admin`.
   - Updated route guards to match actual feature role intent:
     - Restaurant profile: owner, admin, super_admin
     - Staff: owner, admin, super_admin
     - Kitchen: owner, admin, steward
     - Billing: owner, admin, steward
     - Rooms: owner, admin
     - Housekeeping: owner, admin, housekeeper

3. Super admin view switching hardened
   - Super admin restaurant profile page now uses normalized role check.

## Current status after fixes
- Frontend build passes (`npm run build`).
- Super admin redirect and route access now work consistently across `super_admin` and `s_admin` inputs on client state.

## Remaining recommendations
1. Backend role alias policy
   - Backend currently uses enum role values; standardize persisted role strictly as `super_admin`.
   - If external imports can send `s_admin`, map/reject at API boundary.

2. Super admin staff management design decision
   - Staff routes currently include super_admin in router permissions, but many flows are tenant-scoped by `restaurant_id`.
   - Decide one clear model:
     - Platform super admin must choose tenant context explicitly, or
     - Remove super_admin from tenant staff routes and keep only restaurant management at platform level.

3. End-to-end authorization tests
   - Add API tests for role matrix (owner/admin/steward/housekeeper/super_admin) for each protected route.
