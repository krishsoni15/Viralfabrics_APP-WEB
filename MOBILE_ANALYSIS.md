# ViralFabrics — Mobile App Analysis (Phase 1)

> **Project**: Viral Fabrics — CRM / Order Management for Textile Business
> **Stack**: Next.js 15 + React 19 + MongoDB (Mongoose) + Tailwind CSS v4
> **Generated**: 2026-05-26

---

## 1. Pages / Routes — Screens to Build

### Auth
| Web Route | Mobile Screen | Description |
|-----------|--------------|-------------|
| `/login` | `(auth)/login.tsx` | Username + password login (JWT) |
| `/` (root) | — | Auto-redirect: token → dashboard, else → login |

### Dashboard (Protected — requires auth)
| Web Route | Mobile Screen | Description |
|-----------|--------------|-------------|
| `/dashboard` | `(tabs)/dashboard.tsx` | Stats cards, pie charts, upcoming deliveries table, financial-year filters |
| `/orders` | `(tabs)/orders.tsx` | Full order list with search, filters, pagination, status badges |
| `/orders/orderdetails` | `orders/[id].tsx` | Order detail — items, lab data, grey info, mill I/O, dispatches |
| `/fabrics` | `(tabs)/fabrics.tsx` | Fabric catalog with filters (superadmin only) |
| `/sampling` | `(tabs)/sampling.tsx` | Sampling weavers + samples CRUD |
| `/sampling/view/[weaverId]` | `sampling/[weaverId].tsx` | Weaver's sample list |
| `/users` | `users/index.tsx` | User management (superadmin only) |
| `/logs` | `logs/index.tsx` | Activity / audit logs (superadmin only) |
| `/access-denied` | `access-denied.tsx` | 403 page for non-superadmin |

### Profile (inferred from API)
| Web Route | Mobile Screen | Description |
|-----------|--------------|-------------|
| — | `profile/index.tsx` | View/edit own profile, change password |

**Total screens: ~12–14**

---

## 2. Auth System

| Aspect | Detail |
|--------|--------|
| **Method** | Custom JWT (using `jose` library) |
| **Login endpoint** | `POST /api/auth/login` — accepts `{ username, password }` |
| **Token storage (web)** | `localStorage` keys: `token`, `user` + cookie `auth-token` |
| **Token storage (mobile)** | Use `AsyncStorage` for `token` and `user` |
| **Token format** | JWT with payload: `{ id, username, role, name, phoneNumber, address, loginTime, iat, exp }` |
| **Roles** | `superadmin`, `user` |
| **Middleware** | Verifies JWT via `Authorization: Bearer <token>` header |
| **Session validation** | `GET /api/auth/validate-session` |
| **Refresh** | `POST /api/auth/refresh-session` |
| **Logout** | `POST /api/auth/logout` |
| **Logout all** | `POST /api/auth/logout-all` (superadmin) — invalidates all tokens issued before timestamp |
| **Password hashing** | `bcryptjs` |
| **No signup page** | Users are created by superadmin via `/users` page |

---

## 3. API Base URL & Endpoints

**Base URL**: `http://localhost:3000` (dev) — configurable via `EXPO_PUBLIC_API_URL`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/logout-all` | Logout all users (superadmin) |
| GET | `/api/auth/logout-all-status` | Check logout-all status |
| GET | `/api/auth/validate-session` | Validate current token |
| POST | `/api/auth/refresh-session` | Refresh session |
| GET | `/api/auth/logout-events` | SSE for logout events |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/stats-instant` | Fast stats |
| GET | `/api/dashboard/upcoming-deliveries` | Upcoming delivery list |
| GET | `/api/dashboard/upcoming-deliveries-instant` | Fast deliveries |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List orders (paginated, filterable) |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/[id]` | Get single order |
| PUT | `/api/orders/[id]` | Update order |
| DELETE | `/api/orders/[id]` | Delete order |
| PUT | `/api/orders/status` | Update order status |
| GET | `/api/orders/financial-years` | Financial year list |
| DELETE | `/api/orders/delete-all` | Delete all (superadmin) |
| POST | `/api/orders/renumber-ids` | Renumber IDs (superadmin) |
| POST | `/api/orders/reset-counter` | Reset counter (superadmin) |

### Parties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parties` | List parties |
| POST | `/api/parties` | Create party |
| GET | `/api/parties/[id]` | Get party |
| PUT | `/api/parties/[id]` | Update party |
| DELETE | `/api/parties/[id]` | Delete party |

### Qualities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qualities` | List qualities |
| POST | `/api/qualities` | Create quality |
| GET | `/api/qualities/[id]` | Get quality |
| PUT | `/api/qualities/[id]` | Update quality |
| DELETE | `/api/qualities/[id]` | Delete quality |

### Mills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mills` | List mills |
| POST | `/api/mills` | Create mill |
| GET | `/api/mills/[id]` | Get mill |
| PUT | `/api/mills/[id]` | Update mill |
| DELETE | `/api/mills/[id]` | Delete mill |

### Mill Inputs & Outputs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/mill-inputs` | List/Create mill inputs |
| GET/PUT/DELETE | `/api/mill-inputs/[id]` | Single mill input CRUD |
| GET/POST | `/api/mill-outputs` | List/Create mill outputs |
| GET | `/api/mill-outputs/check` | Check mill output existence |
| GET/PUT/DELETE | `/api/mill-outputs/[id]` | Single mill output CRUD |

### Labs (Grey Info)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/labs` | List/Create lab entries |
| GET | `/api/labs/check` | Check lab data existence |
| GET/PUT/DELETE | `/api/labs/[id]` | Single lab CRUD |

### Grey Info
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/grey-info` | List/Create grey info |
| GET | `/api/grey-info/check` | Check grey info existence |
| GET/PUT/DELETE | `/api/grey-info/[id]` | Single grey info CRUD |

### Dispatch
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/dispatch` | List/Create dispatches |
| GET | `/api/dispatch/check` | Check dispatch existence |
| GET/PUT/DELETE | `/api/dispatch/[id]` | Single dispatch CRUD |

### Processes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/processes` | List/Create processes |
| GET/PUT/DELETE | `/api/processes/[id]` | Single process CRUD |

### Fabrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/fabrics` | List/Create fabrics (superadmin) |
| GET/PUT/DELETE | `/api/fabrics/[id]` | Single fabric CRUD |
| GET/POST | `/api/fabrics/quality-names` | Quality names |
| GET/POST | `/api/fabrics/weavers` | Weavers |
| GET/POST | `/api/fabrics/weaver-quality-names` | Weaver quality names |

### Sampling
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/sampling/weavers` | List/Create sampling weavers |
| GET/PUT/DELETE | `/api/sampling/weavers/[id]` | Single weaver CRUD |
| GET/POST | `/api/sampling/samples` | List/Create samples |
| GET/PUT/DELETE | `/api/sampling/samples/[id]` | Single sample CRUD |

### Users (superadmin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/users` | List/Create users |
| GET/PUT/DELETE | `/api/users/[id]` | Single user CRUD |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/profile` | Get/Update own profile |
| GET | `/api/logs` | Activity logs (superadmin) |
| POST | `/api/upload` | S3 image upload |
| GET | `/api/backup` | Database backup (superadmin) |
| GET | `/api/health` | Health check |

---

## 4. Color Palette & Design Tokens

### Theme Mode
- **Supports both** light and dark mode (class-based `dark` toggle)
- Stored in `localStorage` key `darkMode`

### CSS Variables
```
Light:  --background: #ffffff  --foreground: #171717
Dark:   --background: #0a0a0a  --foreground: #ededed
```

### Primary Colors (Blue)
| Token | Hex |
|-------|-----|
| primary-50 | `#eff6ff` |
| primary-100 | `#dbeafe` |
| primary-200 | `#bfdbfe` |
| primary-300 | `#93c5fd` |
| primary-400 | `#60a5fa` |
| **primary-500** | **`#3b82f6`** (main) |
| primary-600 | `#2563eb` |
| primary-700 | `#1d4ed8` |
| primary-800 | `#1e40af` |
| primary-900 | `#1e3a8a` |

### Neutral Colors
| Token | Hex |
|-------|-----|
| neutral-50 | `#fafafa` |
| neutral-100 | `#f5f5f5` |
| neutral-200 | `#e5e5e5` |
| neutral-300 | `#d4d4d4` |
| neutral-400 | `#a3a3a3` |
| neutral-500 | `#737373` |
| neutral-600 | `#525252` |
| neutral-700 | `#404040` |
| neutral-800 | `#262626` |
| neutral-900 | `#171717` |

### Semantic Colors
| Purpose | 50 | 500 | 600 | 700 |
|---------|-----|------|------|------|
| Success | `#f0fdf4` | `#22c55e` | `#16a34a` | `#15803d` |
| Warning | `#fffbeb` | `#f59e0b` | `#d97706` | `#b45309` |
| Error | `#fef2f2` | `#ef4444` | `#dc2626` | `#b91c1c` |
| Info | `#eff6ff` | `#3b82f6` | `#2563eb` | `#1d4ed8` |

### Typography
- **Font**: Geist Sans + Geist Mono (system-ui fallback)
- **Scale**: xs(12px), sm(14px), base(16px), lg(18px), xl(20px), 2xl(24px), 3xl(30px), 4xl(36px)

### Spacing (8px base)
xs=4px, sm=8px, md=16px, lg=24px, xl=32px, 2xl=48px, 3xl=64px, 4xl=96px

### Border Radius
sm=2px, base=4px, md=6px, lg=8px, xl=12px, 2xl=16px, 3xl=24px

### Shadows
Standard Tailwind shadow scale (sm through 2xl) with dark mode variants.

---

## 5. State Management

| Tool | Usage |
|------|-------|
| **Zustand** (v5) | Main app store — user state, sidebar UI, client-side cache |
| **React Context** | `DarkModeContext` — dark/light theme toggle |
| **Custom hooks** | `useDataFetch` (data fetching + caching), `useValidation`, `useToast`, `useServerAction` |
| **localStorage** | Token, user data, darkMode, search state, sidebar collapse |

### Zustand Store Shape (`useAppStore`)
```typescript
{
  user: { _id, name, username, role, phoneNumber, address } | null,
  isSidebarOpen: boolean,
  isSidebarCollapsed: boolean,
  cache: Record<string, { data: any, timestamp: number }>,
  // + actions: setUser, toggleSidebar, closeSidebar, setCache, getCache, clearCache
}
```

---

## 6. Data Models

### User
```
_id, name, username, email?, phoneNumber?, address?, role (superadmin|user),
isActive, lastLogin?, loginCount?, preferences? { theme, language, notifications, timezone },
metadata? { createdBy, department, employeeId, notes }, createdAt, updatedAt
```

### Order
```
_id, orderId, orderNo?, orderType (Dying|Printing), arrivalDate?, party (ref Party),
contactName?, contactPhone?, contactEmail?, poNumber?, styleNo?, poDate?, deliveryDate?,
items: [{ quality (ref Quality), quantity, imageUrls[], description?,
  weaverSupplierName?, purchaseRate?, millRate?, salesRate?,
  labData? { color, shade, notes, imageUrl, labSendDate, approvalDate, sampleNumber, status, remarks },
  processData? { mainProcess, additionalProcesses[] }
}],
status (Not set|pending|in_progress|completed|delivered|cancelled),
priority?, totalAmount?, paymentStatus (pending|partial|paid),
notes?, greyInformation[]?, millInputs[]?, millOutputs[]?, dispatches[]?,
metadata? { createdBy, tags[], source, urgency, complexity }, createdAt, updatedAt
```

### Party
```
_id, name, contactName?, contactPhone?, contactEmail?, address?,
isActive?, category (customer|supplier|partner|other), priority?, createdAt, updatedAt
```

### Quality
```
_id, name, description?, code?, createdAt, updatedAt
```

### Mill
```
_id, name, contactPerson?, contactPhone?, address?, email?, isActive, createdAt, updatedAt
```

### MillInput
```
_id, orderId, order (ref), mill (ref), millDate, chalanNo, greighMtr, pcs,
quality? (ref), additionalMeters[]?, notes?, createdAt, updatedAt
```

### MillOutput
```
_id, orderId, order (ref), recdDate, millBillNo, finishedMtr, createdAt, updatedAt
```

### Fabric
```
_id, qualityCode, qualityName, type?, weaver, weaverQualityName, rack?,
greighWidth, finishWidth, weight, gsm, content, danier, count, reed, pick,
greighRate, label, images[], createdAt, updatedAt
```

### Sample (Sampling)
```
_id, weaverId (ref Weaver), qualityName, type?, rack?, greighWidth, finishWidth,
weight, gsm, content, danier, count, reed, pick, greighRate, label, note?, images[],
createdAt, updatedAt
```

### Sampling Weaver
```
_id, name, phone?, address?
```

---

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing/verifying JWTs |
| `S3_ACCESS_KEY_ID` | AWS S3 (image uploads) — commented out |
| `S3_SECRET_ACCESS_KEY` | AWS S3 secret |
| `S3_BUCKET_NAME` | S3 bucket name |
| `S3_REGION` | S3 region (ap-south-1) |

### Mobile `.env` needs:
```
EXPO_PUBLIC_API_URL=http://<your-ip>:3000
EXPO_PUBLIC_APP_NAME=Viral Fabrics
```

---

## 8. Special Features Needed

| Feature | Required? | Details |
|---------|-----------|---------|
| **Camera / Image Picker** | ✅ Yes | Order items have `imageUrls[]`, fabrics have `images[]`, samples have `images[]`. Web uses `CameraModal.tsx` + S3 upload |
| **Image Upload (S3)** | ✅ Yes | `POST /api/upload` — multipart form data to S3 |
| **PDF Generation** | ⚠️ Optional | `lib/pdfGenerator.ts` (jsPDF) — used for order reports. Can defer to web |
| **Charts** | ✅ Yes | Dashboard uses `recharts` for pie charts — use `react-native-chart-kit` or `victory-native` |
| **Real-time (WebSocket)** | ⚠️ Optional | `socket.io` for logout events — can poll instead |
| **Dark Mode** | ✅ Yes | Full light/dark theme support |
| **Pull to Refresh** | ✅ Yes | All list screens |
| **Search** | ✅ Yes | Orders, fabrics, sampling all have search |
| **Pagination** | ✅ Yes | All list screens paginated |
| **Role-based Access** | ✅ Yes | `superadmin` vs `user` — hide fabrics/users/logs for regular users |
| **Maps** | ❌ No | Not used |
| **Payments** | ❌ No | Payment status is just a field, no payment gateway |
| **Push Notifications** | ⚠️ Optional | Not in web, could add for mobile |
| **Haptics** | ✅ Nice-to-have | Button feedback |
| **Offline** | ⚠️ Optional | Web has `offlineDetection.ts` but no offline-first — can add basic caching |

---

## 9. Navigation Structure (Mobile)

```
Root Stack Navigator
├── (auth) — Stack
│   └── login.tsx
├── (tabs) — Bottom Tab Navigator
│   ├── dashboard.tsx    (🏠 Home)
│   ├── orders.tsx       (📋 Orders)
│   ├── sampling.tsx     (🧵 Sampling)  
│   └── profile.tsx      (👤 Profile)
└── Modals / Detail Stacks
    ├── orders/[id].tsx          (Order Detail)
    ├── orders/create.tsx        (Create Order)
    ├── sampling/[weaverId].tsx  (Weaver Samples)
    ├── fabrics/index.tsx        (Fabrics — superadmin)
    ├── users/index.tsx          (Users — superadmin)
    └── logs/index.tsx           (Logs — superadmin)
```

---

## 10. Summary

| Aspect | Value |
|--------|-------|
| **App Name** | Viral Fabrics |
| **Bundle ID** | `com.viralfabrics.crm` |
| **Total Screens** | ~14 |
| **Auth** | Custom JWT (username/password) |
| **Backend** | Same Next.js API (self-hosted) |
| **Database** | MongoDB Atlas |
| **State** | Zustand + AsyncStorage |
| **Theme** | Light + Dark mode |
| **Icons** | Lucide React → `lucide-react-native` |
| **Key Libraries** | Expo Router, React Query, Axios, Reanimated, NativeWind |

---

*Phase 1 complete. Ready to proceed to Phase 2 (Expo project setup).*
