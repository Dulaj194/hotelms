# HotelMS Session Privileges Management Analysis
**Status:** Production-Grade Implementation  
**Date:** 2026-03-20  
**Analysis Level:** Professional Code Review (PHP Legacy → FastAPI/React Port)

---

## 1. Privilege System Architecture

### 1.1 Session Privilege Lifecycle
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  LOGIN (email + password)                                      │
│  └─→ Backend: Normalize email (trim + lowercase)               │
│      └─→ Authenticate user + fetch restaurant_id               │
│          └─→ Revoke prior refresh_token (session rotation)     │
│              └─→ Build session state (creation + last_seen)    │
│                  └─→ Return: access_token + refresh_token      │
│                                                                 │
│  DASHBOARD MOUNT                                               │
│  └─→ Frontend: GET /api/v1/dashboard/admin-overview           │
│      └─→ Backend: Extract restaurant_id from JWT               │
│          └─→ Fetch subscription + privileges from package      │
│              └─→ Build module_lanes with visibility filters    │
│                  └─→ Return: AdminDashboardOverviewResponse    │
│                      {                                         │
│                        privileges: [...],                      │
│                        module_lanes: [{visible: bool, ...}],   │
│                        ...                                     │
│                      }                                         │
│                                                                 │
│  SIDEBAR RENDERING                                             │
│  └─→ Frontend: Filter lanes where visible === true             │
│      └─→ Show links ONLY for permitted modules                 │
│          └─→ Unauthorized access = 403 at module level         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Privilege Origins
| Source | Phase | Value | Immutability |
|--------|-------|-------|--------------|
| **Subscription Package** | Registration | `["QR_MENU", "HOUSEKEEPING", "OFFERS"]` | Mutable (via package upgrade) |
| **User Role** | Login | `"owner"` \| `"admin"` \| `"steward"` | Fixed per user |
| **Restaurant ID** | Session | Integer | Fixed per session |

---

## 2. Current Implementation Status

### ✅ **IMPLEMENTED: Session Privilege Binding**
**Location:** `backend/app/modules/auth/service.py::login()`
```python
def login(...) -> TokenResponse:
    # 1. Normalize email
    normalized_email = _normalize_login_email(payload.email)
    
    # 2. Fetch user + validate password
    user = get_user_by_email(db, normalized_email)
    
    # 3. Rotate session (revoke prior token)
    _revoke_presented_refresh_session(...)
    
    # 4. Build session state with metadata
    session_state = _build_session_state(...)
    
    # 5. Issue new tokens (restaurant_id embedded in JWT)
    return TokenResponse(
        access_token=create_access_token(user),  # Contains: user.id, restaurant_id
        token_type="bearer",
        must_change_password=user.must_change_password
    )
```

✅ **User ID, restaurant ID, and role are embedded in JWT**  
✅ **No explicit session storage needed** (JWT is stateless)  
✅ **Session rotation prevents fixation attacks**  

---

### ✅ **IMPLEMENTED: Privilege Fetching (Bootstrap)**
**Location:** `backend/app/modules/subscriptions/service.py::get_effective_privileges()`
```python
def get_effective_privileges(db: Session, restaurant_id: int) -> SubscriptionPrivilegeResponse:
    subscription = get_current_subscription_entity(db, restaurant_id)
    status = _effective_status(subscription)
    
    privileges = []
    if subscription and status in {SubscriptionStatus.active, SubscriptionStatus.trial}:
        # Fetch privilege codes from subscription's package
        privileges = list(repository.list_package_privilege_codes(db, subscription.package_id))
    
    return SubscriptionPrivilegeResponse(
        restaurant_id=restaurant_id,
        status=status,
        privileges=sorted(set(privileges))  # ← Deduplicated, sorted
    )
```

✅ **Privileges returned in JSON during dashboard bootstrap**  
✅ **Deduplication prevents duplicate permission entries**  
✅ **Status check ensures only active/trial subscriptions grant privileges**  

---

### ✅ **IMPLEMENTED: Module Visibility Filtering**
**Location:** `backend/app/modules/dashboard/service.py::_build_module_lanes()`
```python
def _build_module_lanes(*, role: str, privileges: list[str]) -> list[DashboardModuleLane]:
    normalized_privileges = {p.upper() for p in privileges}
    lanes = []
    
    for lane in MODULE_LANES:
        role_ok = role in lane["required_roles"]
        privilege_ok = all(req.upper() in normalized_privileges for req in lane["required_privileges"])
        
        lanes.append(
            DashboardModuleLane(
                key=lane["key"],
                label=lane["label"],
                path=lane["path"],
                visible=role_ok and privilege_ok  # ← Gate both role AND privilege
            )
        )
    
    return lanes
```

**Module Lanes Rules (`backend/app/modules/dashboard/rules.py`):**
| Lane Key | Required Roles | Required Privileges | Visible When |
|----------|----------------|-------------------|--------------|
| `dashboard` | `["owner", "admin"]` | `[]` | Owner or Admin |
| `menu_orders` | `["owner", "admin", "steward"]` | `["QR_MENU"]` | Has QR_MENU privilege |
| `housekeeping` | `["owner", "admin"]` | `["HOUSEKEEPING"]` | Has HOUSEKEEPING privilege |
| `offers` | `["owner", "admin"]` | `["OFFERS"]` | Has OFFERS privilege |
| `reports` | `["owner", "admin", "steward"]` | `["QR_MENU"]` | Has QR_MENU privilege |

✅ **Server-side filtering prevents UI policy overrides**  
✅ **Case-insensitive privilege matching (upcase normalization)**  
✅ **Both role AND privilege required** (AND logic, not OR)  

---

### ✅ **IMPLEMENTED: Frontend Module Rendering**
**Location:** `frontend/src/pages/Dashboard.tsx`
```typescript
const visibleLanes = useMemo(() => {
    if (!overview) return [];
    return overview.module_lanes.filter((lane) => lane.visible);
}, [overview]);

// Render only visible lanes
{visibleLanes.map((lane) => (
    <button key={lane.key} onClick={() => navigate(lane.path)}>
        {lane.label}
    </button>
))}
```

✅ **Frontend filters lanes by `visible` flag (no hardcoding)**  
✅ **Navigation paths controlled by backend rules**  
✅ **Unauthorized access redirects via 403 from module endpoints**  

---

## 3. Missing Piece: Default Module Auto-Selection

### ⚠️ **IDENTIFIED GAP: Decision Tree for First-Time Load**

**PHP Legacy Behavior:**
```php
$.get('admin/get_privileges.php', function(data) {
    const privileges = data.privileges;
    
    if (privileges.includes('QR Menu System') && privileges.includes('QR Housekeeping System')) {
        loadContent('menus.php');          // Menu has priority
    } else if (privileges.includes('QR Menu System')) {
        loadContent('menus.php');
    } else if (privileges.includes('QR Housekeeping System')) {
        loadContent('housekeeping.php');
    } else {
        loadContent('login.php');          // Fallback (error state)
    }
});
```

**Current FastAPI/React Behavior:**
- ❌ Module lanes are rendered as buttons
- ❌ No automatic navigation to default page
- ❌ User must manually click a lane button

**Impact:** Users see a "blank" dashboard and must click to navigate  
**Professional Fix:** Implement auto-navigation with priority decision tree  

---

## 4. SOLUTION: Professional Decision Tree Implementation

### 4.1 Backend: Decision Tree Utility

**File:** `backend/app/modules/dashboard/rules.py`

Add after `MODULE_LANES`:
```python
# Priority order for auto-selection (first match wins)
MODULE_SELECTION_PRIORITY = [
    {
        "selector": lambda priv_set: "QR_MENU" in priv_set and "HOUSEKEEPING" in priv_set,
        "lane_key": "menu_orders",      # Menu has priority over housekeeping
    },
    {
        "selector": lambda priv_set: "QR_MENU" in priv_set,
        "lane_key": "menu_orders",
    },
    {
        "selector": lambda priv_set: "HOUSEKEEPING" in priv_set,
        "lane_key": "housekeeping",
    },
    {
        "selector": lambda priv_set: True,  # Always match (error fallback)
        "lane_key": "default",  # Show dashboard with warning
    },
]

def get_default_module(privileges: list[str]) -> str:
    """Determine which module should load by default based on privilege priority."""
    priv_set = {p.upper() for p in privileges}
    for rule in MODULE_SELECTION_PRIORITY:
        if rule["selector"](priv_set):
            return rule["lane_key"]
    return "default"
```

### 4.2 Backend: Extend Dashboard Response

**File:** `backend/app/modules/dashboard/schemas.py`

```python
class AdminDashboardOverviewResponse(BaseModel):
    # ... existing fields ...
    module_lanes: list[DashboardModuleLane]
    privilege_map: DashboardPrivilegeMap
    sla_priority_model: list[str]
    default_module: str  # ← New field: which module to load first
```

### 4.3 Backend: Compute Default Module

**File:** `backend/app/modules/dashboard/service.py::get_admin_dashboard_overview()`

```python
from app.modules.dashboard.rules import get_default_module

def get_admin_dashboard_overview(db: Session, *, restaurant_id: int, role: str):
    # ... existing code ...
    
    module_lanes = _build_module_lanes(role=role, privileges=privileges_response.privileges)
    default_module = get_default_module(privileges_response.privileges)
    
    return AdminDashboardOverviewResponse(
        # ... existing fields ...
        module_lanes=module_lanes,
        default_module=default_module,  # ← Include in response
        privilege_map=DashboardPrivilegeMap(role=role, privileges=privileges_response.privileges),
        sla_priority_model=SLA_PRIORITY_MODEL,
    )
```

### 4.4 Frontend: Type Update

**File:** `frontend/src/types/dashboard.ts`

```typescript
export interface AdminDashboardOverviewResponse {
    // ... existing fields ...
    module_lanes: DashboardModuleLane[];
    privilege_map: DashboardPrivilegeMap;
    sla_priority_model: string[];
    default_module: string;  // ← New field
}
```

### 4.5 Frontend: Auto-Navigation

**File:** `frontend/src/pages/Dashboard.tsx`

```typescript
useEffect(() => {
    let active = true;

    async function loadOverview() {
        try {
            const data = await api.get<AdminDashboardOverviewResponse>("/dashboard/admin-overview");
            if (!active) return;

            setOverview(data);
            // ... existing code ...

            // AUTO-NAVIGATE to default module after brief delay (UX: show dashboard first)
            const timer = setTimeout(() => {
                const defaultLane = data.module_lanes.find(lane => lane.key === data.default_module);
                if (defaultLane?.visible) {
                    navigate(defaultLane.path);
                }
            }, 800);  // Show dashboard for 800ms, then auto-navigate
            
            return () => clearTimeout(timer);
        } catch (err) {
            // ... existing error handling ...
        } finally {
            if (active) {
                setOverviewLoading(false);
            }
        }
    }

    loadOverview();
    return () => {
        active = false;
    };
}, [navigate]);
```

---

## 5. Verification Checklist

### 🔐 **Session Privilege Sanity Checks**

- [x] **Email normalization:** Both login sides trim + lowercase
  - Backend: `_normalize_login_email()` in `auth/service.py`
  - Frontend: `.trim().toLowerCase()` in `Login.tsx`

- [x] **Generic auth errors:** No "user not found" vs "password wrong" distinction
  - All failures: `"Invalid email or password."`
  - Applied at: `Login` route, frontend Login.tsx error handler, auth service

- [x] **Session rotation:** Prior refresh token revoked before issuing new
  - `_revoke_presented_refresh_session()` called at start of `login()`
  - Prevents session fixation attacks

- [x] **Session state metadata:** Idle + absolute timeout tracking
  - `creation_at` + `last_seen` stored in Redis session key
  - Checked before issuing new access token in `refresh()`

- [x] **JWT contains restaurant_id:** Embedded in token, not fetched from payload
  - `create_access_token(user)` includes `restaurant_id` from user object
  - All endpoints use `current_user.restaurant_id` (from JWT)
  
- [x] **Multi-tenant isolation:** All queries filter by restaurant_id from JWT
  - Dashboard: `get_admin_dashboard_overview(restaurant_id=current_user.restaurant_id, role=...)`
  - Orders: `db.query(Order).filter(Order.restaurant_id == current_user.restaurant_id)`
  - Alerts/Setup: `repository.get_alert_impression_for_day(restaurant_id=restaurant_id, ...)`

---

### 📊 **Privilege Fetching Checks**

- [x] **Privileges cached in JWT:** No (fresh fetch on each dashboard load)
  - **Rationale:** Privileges can change mid-session (package upgrade)
  - **Trade-off:** 1 extra DB query per dashboard load (acceptable)
  - **Optimization:** Could add 5-minute Redis cache if needed

- [x] **Privileges sorted + deduplicated:** Yes
  - `sorted(set(privileges))` in `get_effective_privileges()`

- [x] **Subscription status check:** Only active/trial grant privileges
  - `if subscription and status in {active, trial}:`
  - Expired subscriptions get empty privilege list

- [x] **Package privilege resolution:** Correct package_id used
  - `list_package_privilege_codes(db, subscription.package_id)`
  - Not hardcoded per restaurant

---

### 🎯 **Module Visibility Checks**

- [x] **Role + Privilege AND logic:** Both required (not OR)
  - `visible=role_ok and privilege_ok`
  - Not just privilege-based

- [x] **Privilege case-insensitive matching:** Normalized to uppercase
  - `normalized_privileges = {p.upper() for p in privileges}`
  - Rules also uppercased: `req.upper() in normalized_privileges`

- [x] **Server-side filter only:** No client-side override possible
  - Browser DevTools cannot unlock hidden lanes
  - Unauthorized module access hits 403 at endpoint layer

- [x] **Sidebar honors module_lanes:** Frontend filters by `lane.visible`
  - No hardcoded links in sidebar
  - All links come from backend response

---

### 🚀 **Default Module Selection (NEW)**

- [ ] **Priority decision tree defined:** Needs implementation
- [ ] **Backend exposes `default_module` field:** Needs implementation
- [ ] **Frontend auto-navigates on mount:** Needs implementation

---

## 6. Clean Code Structure (Professional Standards)

### ✅ **No Duplication**
- Privilege rules centralized in `backend/app/modules/dashboard/rules.py`
- Module lanes defined once, not scattered across files
- Decision tree logic in one utility function

### ✅ **Type Safety**
- TypeScript interfaces for all responses: `DashboardPrivilegeMap`, `DashboardModuleLane`
- Pydantic schemas enforced at API boundaries
- No `any` types in privilege-related code

### ✅ **Error Handling**
- Expired subscriptions → empty privilege list (not error)
- Missing subscription → status "none" (not error)
- Unauthorized module access → 403 (explicit, not 500)

### ✅ **Security**
- Restaurant ID from JWT, not request payload
- Session rotation on login (no fixation)
- Generic error messages (no info leaks)
- Case-insensitive privilege matching (prevents bypasses)

### ✅ **Performance**
- Module lanes computed once per dashboard load
- Privileges fetched once per session (subscription changes rare)
- Frontend filters already-loaded lanes (no extra API calls)

---

## 7. Recommended Next Steps

### Priority 1: Implement Default Module Selection (20 min)
1. Add `MODULE_SELECTION_PRIORITY` and `get_default_module()` to `rules.py`
2. Update `AdminDashboardOverviewResponse` to include `default_module`
3. Compute and return `default_module` in `get_admin_dashboard_overview()`
4. Update frontend Dashboard.tsx to auto-navigate

### Priority 2: Test & Validate (30 min)
1. Login as owner (has all privileges) → should navigate to menu module
2. Login as admin with housekeeping-only privilege → should navigate to housekeeping
3. Verify sidebar shows only authorized lanes
4. Verify unauthorized module access returns 403

### Priority 3: Documentation (optional)
1. Add decision tree diagram to README
2. Document privilege-module mapping in code comments
3. Create runbook for privilege troubleshooting

---

## 8. Appendix: Privilege-Module Mapping Reference

```json
{
  "QR_MENU": ["menu_orders", "reports"],
  "HOUSEKEEPING": ["housekeeping"],
  "OFFERS": ["offers"],
  "QR_MENU + HOUSEKEEPING": ["menu_orders", "housekeeping", "reports"],
  "QR_MENU + HOUSEKEEPING + OFFERS": ["menu_orders", "housekeeping", "offers", "reports"]
}
```

**Package Assignments:**
- Basic: `["QR_MENU"]` → Menu + Reports
- Professional: `["QR_MENU", "HOUSEKEEPING"]` → Menu + Reports + Housekeeping
- Enterprise: `["QR_MENU", "HOUSEKEEPING", "OFFERS"]` → All modules

---

**END OF ANALYSIS**
