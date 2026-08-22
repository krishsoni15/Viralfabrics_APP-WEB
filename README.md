<p align="center">
  <img src="public/vflogo/android-chrome-512x512.png" alt="Viral Fabrics Logo" width="120" />
</p>

<h1 align="center">🧵 Viral Fabrics — Enterprise Textile ERP & CRM Platform</h1>

<p align="center">
  <strong>A full-stack, production-grade Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) platform purpose-built for the textile and fabric manufacturing industry.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Expo-56-000020?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/React%20Native-0.85-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8?logo=pwa" alt="PWA" />
  <img src="https://img.shields.io/badge/AWS%20Amplify-Deployed-FF9900?logo=aws-amplify" alt="AWS Amplify" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker" alt="Docker" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Data Models](#-data-models)
- [API Reference](#-api-reference)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Web Application (CRM Dashboard)](#-web-application-crm-dashboard)
- [Mobile Application (React Native)](#-mobile-application-react-native)
- [Progressive Web App (PWA)](#-progressive-web-app-pwa)
- [Real-Time Engine](#-real-time-engine)
- [PDF Generation Engine](#-pdf-generation-engine)
- [Security & Performance](#-security--performance)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Deployment](#-deployment)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Scripts Reference](#-scripts-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

**Viral Fabrics** is an end-to-end enterprise platform that digitizes the entire textile manufacturing workflow — from raw grey material procurement and weaver management through dying/printing orders, quality sampling, mill processing, finished lot stock tracking, and final dispatch to parties/customers.

The platform ships as a **monorepo** containing:

| Deliverable | Technology | Description |
|:---|:---|:---|
| **Web Dashboard** | Next.js 15 + React 19 | Full-featured CRM admin panel with analytics, reporting, and PDF generation |
| **Mobile App** | Expo 56 + React Native 0.85 | Native Android & iOS companion for on-the-go inventory and order management |
| **PWA** | Service Worker + Web App Manifest | Installable progressive web app with offline caching and push-to-home-screen |
| **Real-Time Engine** | Socket.IO | Live data sync, instant notifications, and remote logout broadcasts |
| **REST API** | Next.js API Routes | 33+ API endpoints powering all CRUD operations, auth, file uploads, and PDF generation |

---

## ✨ Key Features

### 📦 Inventory & Supply Chain
- **Grey Materials Management** — Track raw grey fabric inventory grouped by quality code, with weaver attribution, challan dates, rates, piece counts, and meter measurements
- **Finish Lot Stocks** — Monitor finished fabric lots ready for dispatch
- **Fabric Catalog** — Maintain a master catalog of all fabric types, qualities, and specifications
- **Quality Management** — Define and manage quality codes, names, and type classifications

### 📋 Order Management
- **Order Lifecycle** — Create, track, and manage orders through statuses: Pending → In Progress → Completed → Delivered → Cancelled
- **Order Types** — Support for Dying and Printing order workflows
- **Purchase Orders (PO)** — Generate POs with auto-incrementing financial-year-aware numbering (e.g., `VF/PO/25-26/0001`)
- **Payment Tracking** — Monitor payment statuses: Pending, Partial, Paid
- **Urgency & Complexity Levels** — Classify orders by urgency (Low/Medium/High/Urgent) and complexity (Simple/Moderate/Complex)

### 🧶 Weaver & Supplier Network
- **Weaver Registry** — Manage weaver profiles, assigned qualities, and production history
- **Sampling & Trials** — Track fabric samples assigned to weavers with per-weaver sampling records
- **Party & Contact Management** — Maintain customer/supplier/partner directory with multi-contact support

### 🏭 Mill Processing
- **Mill Management** — Track mill inputs, outputs, and processing stages
- **Process Tracking** — Define and monitor multi-stage fabric processing workflows
- **Lab Testing** — Record and manage lab test results tied to quality batches

### 📊 Analytics & Reporting
- **Real-Time Dashboard** — KPI metrics cards, pie charts, delivery-soon tables with financial year filtering
- **PDF Report Generation** — Professional PDF reports for orders, purchase orders, grey materials inventory (quality-wise), and fabric stickers
- **QR Code Integration** — Auto-generated QR codes embedded in sticker PDFs
- **Excel Export** — XLSX export support for data portability
- **Data Backup** — One-click full database backup with ZIP download

### 🔐 Security & Access
- **JWT Authentication** — Secure token-based auth with `jose` library
- **Role-Based Access Control** — Granular permissions across 5 user roles
- **API Rate Limiting** — Upstash Redis-powered rate limiting to prevent abuse
- **CORS Protection** — Configurable cross-origin resource sharing
- **Input Sanitization** — Server-side validation with Zod schemas
- **CSRF Protection** — Cross-Site Request Forgery prevention
- **Rootless Docker** — Production containers run as non-root `node` user

### 🎨 User Experience
- **Dark Mode** — Persistent system-wide dark/light theme toggle
- **Responsive Design** — Fully responsive from mobile (320px) to ultra-wide (3840px)
- **Skeleton Loading** — Premium loading states with shimmer animations
- **Toast Notifications** — Non-blocking success/error/warning notifications
- **Image Management** — Camera capture, gallery upload, S3 cloud storage, and image preview modals
- **Accessibility** — Semantic HTML, ARIA labels, keyboard navigation support

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
├──────────────────────┬──────────────────────┬───────────────────────┤
│    Web Dashboard     │    Mobile App        │        PWA            │
│  (Next.js 15 SSR)    │ (Expo + React Native)│ (Service Worker)      │
│  React 19 + Tailwind │  NativeWind + Zustand│ Offline-First Cache   │
├──────────────────────┴──────────────────────┴───────────────────────┤
│                                                                     │
│                    ┌─────────────────────┐                          │
│                    │   Socket.IO Server   │  ← Real-Time Engine     │
│                    │  (WebSocket + Poll)  │                          │
│                    └─────────┬───────────┘                          │
│                              │                                      │
├──────────────────────────────┼──────────────────────────────────────┤
│                       API LAYER                                     │
│              Next.js API Routes (33+ endpoints)                     │
│     ┌────────┬────────┬─────────┬──────────┬──────────────┐        │
│     │  Auth  │ Orders │ Fabrics │ Weavers  │ Grey Mats    │        │
│     │  JWT   │ CRUD   │ CRUD    │ CRUD     │ Inventory    │        │
│     ├────────┼────────┼─────────┼──────────┼──────────────┤        │
│     │ POs    │ Mills  │ Parties │ Sampling │ Upload/S3    │        │
│     │ PDF    │ I/O    │ Contacts│ Labs     │ Proxy Image  │        │
│     └────────┴────────┴─────────┴──────────┴──────────────┘        │
├─────────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                                  │
│  ┌──────────┬──────────┬───────────┬──────────┬────────────────┐   │
│  │Rate Limit│  Cache   │ PDF Gen   │Validation│  Error Handler │   │
│  │(Upstash) │(In-Mem)  │(jsPDF)    │ (Zod)    │  (Global)      │   │
│  └──────────┴──────────┴───────────┴──────────┴────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                       DATA LAYER                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │    MongoDB        │  │   AWS S3          │  │  Upstash Redis  │  │
│  │   (Mongoose 8)    │  │ (Image Storage)   │  │ (Rate Limiting) │  │
│  │   25 Models       │  │ (Pre-signed URLs) │  │ (Session Cache) │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technology Stack

### Web Application

| Category | Technology | Version |
|:---|:---|:---|
| **Framework** | Next.js (App Router) | 15.5+ |
| **UI Library** | React | 19.2 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **State Management** | Zustand | 5.x |
| **Database** | MongoDB (via Mongoose) | 8.17 |
| **Authentication** | JWT (via jose) | 6.x |
| **Real-Time** | Socket.IO | 4.8 |
| **Rate Limiting** | Upstash Redis + Ratelimit | 2.x |
| **PDF Generation** | jsPDF + jsPDF-AutoTable | 3.x / 5.x |
| **QR Codes** | qrcode | 1.5 |
| **Charts** | Recharts | 3.x |
| **Excel Export** | xlsx (SheetJS) | 0.18 |
| **File Storage** | AWS S3 (with pre-signed URLs) | 3.x SDK |
| **Icons** | Heroicons + Lucide React | 2.x / 0.54 |
| **UI Components** | Headless UI | 2.x |
| **Schema Validation** | Zod | 4.x |
| **Archive** | JSZip | 3.x |
| **CSS Utilities** | clsx + tailwind-merge | 2.x |
| **HTTP Server** | Custom Node.js (server.js) | 20 LTS |

### Mobile Application

| Category | Technology | Version |
|:---|:---|:---|
| **Framework** | Expo | 56.x |
| **Runtime** | React Native | 0.85 |
| **Navigation** | Expo Router (file-based) | 56.x |
| **State Management** | Zustand | 4.x |
| **Data Fetching** | TanStack React Query | 5.x |
| **HTTP Client** | Axios | 1.x |
| **Styling** | NativeWind (Tailwind for RN) | — |
| **Animations** | React Native Reanimated | 4.3 |
| **Lists** | Shopify FlashList | 2.0 |
| **Camera** | expo-camera | 56.x |
| **Image Picker** | expo-image-picker | 56.x |
| **File System** | expo-file-system | 56.x |
| **Sharing** | expo-sharing | 56.x |
| **PDF Printing** | expo-print | 56.x |
| **Haptics** | expo-haptics | 56.x |
| **OTA Updates** | expo-updates (EAS Update) | 56.x |
| **Icons** | Lucide React Native | 0.36 |
| **WebView** | react-native-webview | 13.x |
| **Architecture** | React Native New Architecture | Enabled |
| **Compiler** | React Compiler (experimental) | Enabled |

### Infrastructure & DevOps

| Category | Technology |
|:---|:---|
| **Hosting (Web)** | AWS Amplify |
| **Hosting (Mobile)** | Expo EAS Build + EAS Update |
| **Containerization** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |
| **Node Runtime** | Node.js 20 LTS |
| **Package Manager** | npm |
| **Linting** | ESLint 9 + eslint-config-next |
| **Formatting** | Prettier 3 |

---

## 📂 Repository Structure

```
ViralFabrics/
├── app/                          # Next.js App Router
│   ├── (pages)/(dashboard)/      # Protected dashboard pages
│   │   ├── dashboard/            #   ├─ Analytics dashboard (KPIs, charts, tables)
│   │   ├── orders/               #   ├─ Order management (CRUD, status tracking)
│   │   ├── purchase-orders/      #   ├─ Purchase order management + PO PDF
│   │   ├── fabrics/              #   ├─ Fabric catalog management
│   │   ├── grey-materials/       #   ├─ Grey material inventory (quality-wise)
│   │   ├── finish-lot-stocks/    #   ├─ Finished lot stock tracking
│   │   ├── weaver/               #   ├─ Weaver management
│   │   ├── sampling/             #   ├─ Sampling & trial management
│   │   ├── users/                #   ├─ User administration
│   │   ├── logs/                 #   ├─ System activity logs
│   │   ├── components/           #   ├─ Shared UI (Sidebar, Navbar, Camera, PWA)
│   │   └── hooks/                #   └─ Custom hooks (dark mode, auth, socket)
│   ├── api/                      # REST API Routes (33+ endpoints)
│   │   ├── auth/                 #   ├─ Login, logout, session management
│   │   ├── orders/               #   ├─ Order CRUD + status transitions
│   │   ├── purchase-orders/      #   ├─ PO CRUD + PDF generation
│   │   ├── fabrics/              #   ├─ Fabric CRUD + copy operations
│   │   ├── grey-materials/       #   ├─ Grey material inventory CRUD
│   │   ├── finish-lot-stocks/    #   ├─ Stock CRUD
│   │   ├── weaver/               #   ├─ Weaver registry CRUD
│   │   ├── sampling/             #   ├─ Sampling CRUD
│   │   ├── parties/              #   ├─ Party/contact management
│   │   ├── mills/                #   ├─ Mill CRUD
│   │   ├── mill-inputs/          #   ├─ Mill input tracking
│   │   ├── mill-outputs/         #   ├─ Mill output tracking
│   │   ├── processes/            #   ├─ Process workflow CRUD
│   │   ├── labs/                 #   ├─ Lab testing records
│   │   ├── qualities/            #   ├─ Quality code management
│   │   ├── users/                #   ├─ User CRUD + role management
│   │   ├── upload/               #   ├─ S3 file upload (pre-signed URLs)
│   │   ├── download/             #   ├─ File download endpoints
│   │   ├── backup/               #   ├─ Database backup (ZIP export)
│   │   ├── dashboard/            #   ├─ Dashboard analytics aggregation
│   │   ├── dispatch/             #   ├─ Dispatch tracking
│   │   ├── logs/                 #   ├─ Activity log queries
│   │   ├── health/               #   ├─ Health check endpoint
│   │   ├── realtime/             #   ├─ Real-time event endpoints
│   │   └── performance/          #   └─ Performance monitoring
│   ├── contexts/                 # React Context providers
│   ├── hooks/                    # Global custom hooks
│   ├── services/                 # Business logic services
│   ├── repositories/             # Data access layer
│   ├── store/                    # Zustand global state
│   ├── validators/               # Zod validation schemas
│   └── utils/                    # Client-side utilities
├── lib/                          # Server-side libraries
│   ├── pdfGenerator.ts           #   ├─ PDF engine (orders, stickers, grey reports)
│   ├── poPdfGenerator.ts         #   ├─ Purchase Order PDF generator
│   ├── auth.ts                   #   ├─ JWT auth utilities
│   ├── dbConnect.ts              #   ├─ MongoDB connection manager (pooling)
│   ├── socketServer.ts           #   ├─ Socket.IO server integration
│   ├── rateLimit.ts              #   ├─ Upstash Redis rate limiter
│   ├── imageUtils.ts             #   ├─ S3 image upload/resize
│   ├── validation.ts             #   ├─ Server-side validation
│   ├── sanitize.ts               #   ├─ Input sanitization
│   ├── logger.ts                 #   ├─ Structured logging
│   ├── cache.ts                  #   ├─ In-memory caching layer
│   ├── offlineDetection.ts       #   ├─ Offline/online state detection
│   ├── performance.ts            #   ├─ Performance monitoring
│   └── security/                 #   └─ Security utilities (CSRF, etc.)
├── models/                       # Mongoose schemas (25 models)
├── constants/                    # Enums, config constants, validation limits
├── types/                        # TypeScript type definitions
├── utils/                        # Shared utility functions
├── components/                   # Shared React components
├── public/                       # Static assets
│   ├── manifest.json             #   ├─ PWA Web App Manifest
│   ├── sw.js                     #   ├─ Service Worker (offline caching)
│   └── vflogo/                   #   └─ Brand icons & favicons
├── scripts/                      # CLI utilities
│   ├── createMaster.js           #   ├─ Create master admin user
│   ├── update-sw-version.js      #   ├─ Auto-update service worker version
│   ├── reset-fy-counter.ts       #   ├─ Reset financial year counters
│   └── migrate_pos.js            #   └─ Purchase order migration script
├── mobile-app/                   # Expo + React Native mobile app
│   ├── app/                      #   ├─ File-based routing (Expo Router)
│   │   ├── (auth)/               #   │   ├─ Login/auth screens
│   │   ├── (tabs)/               #   │   ├─ Tab navigation screens
│   │   │   ├── dashboard.tsx     #   │   │   ├─ Analytics dashboard
│   │   │   ├── orders.tsx        #   │   │   ├─ Order management
│   │   │   ├── purchase-orders   #   │   │   ├─ Purchase orders + PDF
│   │   │   ├── fabrics.tsx       #   │   │   ├─ Fabric catalog
│   │   │   ├── profile.tsx       #   │   │   ├─ User profile + settings
│   │   │   ├── sampling/         #   │   │   ├─ Sampling management
│   │   │   └── weaver/           #   │   │   └─ Weaver management
│   │   ├── users/                #   │   ├─ User admin screens
│   │   ├── orders/               #   │   ├─ Order detail screens
│   │   ├── grey-materials/       #   │   ├─ Grey material screens
│   │   ├── finish-lot-stock/     #   │   ├─ Stock screens
│   │   └── logs/                 #   │   └─ Activity log screens
│   ├── services/                 #   ├─ API service layer (Axios)
│   ├── store/                    #   ├─ Zustand state management
│   ├── components/               #   ├─ Shared mobile components
│   ├── hooks/                    #   ├─ Custom React hooks
│   ├── utils/                    #   ├─ Utilities (PO PDF template, etc.)
│   ├── constants/                #   ├─ Config (API URL, theme)
│   └── assets/                   #   └─ App icons, splash screen, fonts
├── server.js                     # Custom HTTP server (Socket.IO)
├── middleware.ts                 # Next.js edge middleware (auth, CORS)
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Dev + prod container orchestration
├── amplify.yml                   # AWS Amplify deployment config
└── .github/workflows/ci.yml     # GitHub Actions CI/CD pipeline
```

---

## 🗃 Data Models

The platform uses **25 Mongoose models** powering the entire data layer:

| Model | Purpose |
|:---|:---|
| `User` | User accounts with roles, contacts, linked parties, theme preferences |
| `Order` | Fabric orders with full lifecycle tracking, specifications, payments |
| `PurchaseOrder` | Purchase orders with auto-incrementing FY-aware numbering |
| `Fabric` | Master fabric catalog with images, qualities, and specifications |
| `GreyMaterial` | Raw grey fabric inventory (quality code, weaver, challan, rate, meter) |
| `FinishLotStock` | Finished lot stock tracking |
| `Quality` | Quality code definitions and classifications |
| `QualityName` | Quality name lookup table |
| `Weaver` | Weaver registry |
| `WeaverQualityName` | Weaver-to-quality mapping |
| `Party` | Customer/supplier/partner directory with contacts |
| `Broker` | Broker/agent profiles |
| `Supplier` | Supplier profiles |
| `Sample` | Fabric samples and trial records |
| `Sampling` | Sampling assignment records |
| `SamplingWeaver` | Weaver-level sampling records |
| `Mill` | Mill processing facility records |
| `MillOutput` | Mill production output tracking |
| `Process` | Multi-stage processing workflow definitions |
| `Dispatch` | Order dispatch and delivery records |
| `Lab` | Laboratory testing results |
| `GreyInfo` | Grey fabric additional metadata |
| `Log` | System activity and audit logs |
| `Counter` | Auto-increment counters (FY-aware PO numbering) |
| `SystemConfig` | System-wide configuration settings |

---

## 🔌 API Reference

All APIs are served under `/api/` with JWT authentication enforced via Next.js middleware.

| Endpoint | Methods | Description |
|:---|:---|:---|
| `/api/auth/login` | POST | Authenticate and receive JWT token |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/orders` | GET, POST | List/create orders |
| `/api/orders/[id]` | GET, PUT, DELETE | Read/update/delete order |
| `/api/purchase-orders` | GET, POST | List/create purchase orders |
| `/api/purchase-orders/[id]` | GET, PUT, DELETE | Read/update/delete PO |
| `/api/fabrics` | GET, POST | List/create fabrics |
| `/api/fabrics/[id]` | GET, PUT, DELETE | Read/update/delete fabric |
| `/api/grey-materials` | GET, POST | List/create grey materials |
| `/api/grey-materials/[id]` | GET, PUT, DELETE | Read/update/delete grey material |
| `/api/finish-lot-stocks` | GET, POST | List/create finish lot stocks |
| `/api/weaver/weavers` | GET, POST | List/create weavers |
| `/api/sampling` | GET, POST | List/create sampling records |
| `/api/parties` | GET, POST | List/create parties |
| `/api/mills` | GET, POST | List/create mills |
| `/api/mill-inputs` | GET, POST | List/create mill inputs |
| `/api/mill-outputs` | GET, POST | List/create mill outputs |
| `/api/processes` | GET, POST | List/create processes |
| `/api/labs` | GET, POST | List/create lab records |
| `/api/qualities` | GET, POST | List/create quality codes |
| `/api/users` | GET, POST | List/create users |
| `/api/users/[id]` | GET, PUT, DELETE | Read/update/delete user |
| `/api/upload` | POST | Upload files to AWS S3 |
| `/api/download` | GET | Download files |
| `/api/backup` | GET | Full database backup (ZIP) |
| `/api/dashboard` | GET | Dashboard analytics data |
| `/api/dispatch` | GET, POST | Dispatch records |
| `/api/logs` | GET | Activity & audit logs |
| `/api/health` | GET | Health check (public) |
| `/api/realtime` | GET | Real-time event stream |
| `/api/performance` | GET | Performance metrics |
| `/api/fabric-stickers` | POST | Generate sticker PDFs |
| `/api/proxy-image` | GET | Proxy external images (public) |

---

## 🔐 Role-Based Access Control (RBAC)

The platform enforces granular access control across 4 user roles:

| Role | Access Level | Capabilities |
|:---|:---|:---|
| **Master** | 🔴 Full System | All CRUD operations, user management, database backup, system config, delete operations, logout-all broadcast |
| **Superadmin** | 🟠 Administrative | Full CRUD, user management, report generation, bulk operations |
| **User** | 🟢 Standard | View dashboards, manage assigned orders/fabrics, generate PDFs, limited edit |
| **Party** | 🔵 External | View linked orders and fabrics only, restricted to party-specific data, contact-scoped |

> **Note:** Authentication is enforced at the middleware level using JWT tokens verified with the `jose` library. Each API route checks the `role` claim from the decoded JWT payload.

---

## 💻 Web Application (CRM Dashboard)

The web dashboard is a **Next.js 15 App Router** application with **React 19** and **Tailwind CSS 4**.

### Dashboard Modules

| Module | Description |
|:---|:---|
| **Dashboard** | Real-time KPI metrics cards, order distribution pie charts, delivery-soon tables, financial year filtering |
| **Orders** | Full order lifecycle management with status tracking, party assignment, specification editing, multi-image upload, and PDF export |
| **Purchase Orders** | PO creation with auto-incrementing FY-aware numbering (`VF/PO/25-26/0001`), PDF preview and download, specification management |
| **Fabrics** | Master fabric catalog with quality codes, image galleries, bulk operations, and copy functionality |
| **Grey Materials** | Raw material inventory grouped by quality code → weaver, with quality-wise subtotals, PDF report generation, and image preview |
| **Finish Lot Stocks** | Finished lot tracking and inventory management |
| **Weaver** | Weaver registry with quality assignments, production history, and detailed profiles |
| **Sampling** | Fabric sample management with weaver-level trial tracking |
| **Users** | User administration: create, edit, delete users, assign roles, link to parties, manage contacts |
| **Activity Logs** | System-wide audit trail with severity levels (Info/Warning/Error/Critical) and detailed context |

### UI Highlights
- 🌙 **Dark/Light Mode** — System-wide persistent theme toggle
- 📱 **Fully Responsive** — Optimized breakpoints from 320px mobile to 3840px ultrawide
- ⚡ **Skeleton Loading** — Premium shimmer loading states for every data-fetching component
- 🔔 **Toast System** — Non-blocking notifications with auto-dismiss
- 📸 **Camera Modal** — In-browser camera capture with device selection
- 🖼️ **Image Preview** — Full-screen image lightbox with gallery navigation
- 🗂️ **Collapsible Sidebar** — Responsive sidebar with icon-only collapsed mode
- 🎯 **Error Boundaries** — Graceful error handling with recovery UI

---

## 📱 Mobile Application (React Native)

The mobile companion app is built with **Expo SDK 56**, **React Native 0.85**, and the **React Native New Architecture** enabled.

### Mobile Screens

| Screen | Description |
|:---|:---|
| **Login** | Secure authentication with token persistence via AsyncStorage |
| **Dashboard** | Mobile-optimized analytics with KPI cards and charts |
| **Orders** | Full order management with status transitions, search, and filtering |
| **Purchase Orders** | PO management with on-device HTML-to-PDF generation via `expo-print` |
| **Fabrics** | Fabric catalog browsing with image galleries |
| **Weaver** | Weaver profiles with quality assignments |
| **Sampling** | Per-weaver sampling management with detail views |
| **Grey Materials** | Grey material inventory browsing |
| **Finish Lot Stock** | Stock tracking |
| **Users** | User creation and management (role selection, party linking, contacts) |
| **Profile** | User profile with dark/light mode toggle, app info, logout |
| **Activity Logs** | System log viewer |

### Mobile Highlights
- 🏗️ **New Architecture** — React Native's new rendering engine (Fabric + TurboModules) enabled
- ⚡ **React Compiler** — Experimental React Compiler for automatic memoization
- 📋 **FlashList** — Shopify's FlashList for ultra-performant scrolling lists
- 🎭 **Reanimated 4** — 60fps animations running on the UI thread
- 📱 **Haptic Feedback** — Tactile feedback on interactions via expo-haptics
- 📸 **Camera + Gallery** — Photo capture and gallery picker with image manipulation
- 📄 **On-Device PDF** — Generate PO PDFs directly on-device via expo-print
- 🔄 **OTA Updates** — Over-the-air updates via EAS Update (staging + production channels)
- 🌐 **Offline Support** — AsyncStorage persistence + network state detection
- 🎨 **Dark Mode** — Persistent theme matching web dashboard

### Mobile Build & Distribution

| Platform | Method |
|:---|:---|
| **Android APK** | EAS Build (`eas build --platform android --profile preview`) |
| **Android Play Store** | EAS Build (`eas build --platform android --profile production`) |
| **iOS Simulator** | EAS Build (`eas build --platform ios --profile simulator`) |
| **iOS TestFlight** | EAS Build + Submit (`eas build --platform ios --profile production && eas submit`) |
| **OTA Update** | `npm run update:production` or `npm run update:staging` |

---

## 📲 Progressive Web App (PWA)

The web dashboard is fully installable as a **Progressive Web App** with:

- ✅ **Web App Manifest** — Custom app name, theme color (`#3B82F6`), standalone display mode, home screen shortcuts
- ✅ **Service Worker** — Custom `sw.js` with versioned caching strategy:
  - **Static Cache** — Pre-caches critical pages (`/`, `/dashboard`, `/orders`, `/weaver`)
  - **Dynamic Cache** — Runtime caching for API responses and assets
  - **Cache-First Strategy** — Serves cached content instantly, updates in background
  - **Auto-Versioning** — Build-time version stamping ensures cache invalidation on deploy
- ✅ **Offline Support** — Core pages and cached API data available offline
- ✅ **Install Prompt** — Custom PWA install banner with platform detection
- ✅ **App Shortcuts** — Quick access to Orders and Dashboard from home screen icon

---

## ⚡ Real-Time Engine

The platform integrates **Socket.IO 4** for live data synchronization:

- **Custom HTTP Server** — `server.js` wraps Next.js with a raw Node.js HTTP server to attach Socket.IO
- **WebSocket + Polling** — Dual transport with automatic fallback
- **Global Broadcast** — `global.io` instance accessible from any API route for server-initiated events
- **Live Events:**
  - Order status changes → instant dashboard updates
  - New order creation → real-time notification
  - Remote logout broadcast → force-logout all sessions
  - Data mutations → cross-client synchronization

---

## 📄 PDF Generation Engine

The platform includes a powerful server-side PDF generation engine built with **jsPDF** and **jsPDF-AutoTable**:

| PDF Type | Description |
|:---|:---|
| **Order PDF** | Detailed order report with specifications, party info, images, and status |
| **Purchase Order PDF** | Professional PO document with specifications, terms, auto-incrementing number |
| **Grey Materials Report** | Quality-wise inventory report grouped by quality code with subtotals |
| **Fabric Sticker PDF** | Printable stickers with QR codes, fabric details, and batch information |

### PDF Features
- 📊 **AutoTable** — Dynamic table generation with rowspan grouping, styled headers, and custom cell rendering
- 🖼️ **Image Embedding** — S3-hosted images fetched and embedded directly in PDFs
- 📱 **QR Codes** — Auto-generated QR codes via the `qrcode` library
- 🎨 **Styled Design** — Indigo accent bars, slate text, alternating row backgrounds
- 📐 **Quality-Wise Grouping** — Grey materials grouped by quality code → weaver with subtotals

---

## 🔒 Security & Performance

### Security Layers

| Layer | Implementation |
|:---|:---|
| **Authentication** | JWT tokens (jose library), HTTP-only considerations, token expiry |
| **Authorization** | Role-based middleware checks on every protected route |
| **Rate Limiting** | Upstash Redis with configurable windows and limits |
| **Input Validation** | Zod schemas for request body validation |
| **Input Sanitization** | Server-side HTML/XSS sanitization |
| **CORS** | Configurable origin allowlists with credential support |
| **CSRF** | Cross-Site Request Forgery token protection |
| **Body Size Limits** | 10MB upload limit enforced at middleware level |
| **Container Security** | Docker runs as non-root `node` user |
| **Secrets Management** | Environment variables via `.env` (never committed) |

### Performance Optimizations

| Optimization | Description |
|:---|:---|
| **MongoDB Connection Pooling** | Singleton connection with warm pool |
| **MongoDB Index Optimization** | Compound indexes on frequently queried fields |
| **In-Memory Caching** | Server-side cache layer with TTL-based invalidation |
| **Request Deduplication** | Prevents duplicate concurrent API calls |
| **Image Optimization** | Next.js automatic WebP/AVIF conversion, responsive sizes |
| **Package Import Optimization** | Tree-shaking for lucide-react and heroicons |
| **Console Stripping** | Production builds remove `console.log` (keep error/warn) |
| **Memory Management** | 4GB V8 heap limit, on-demand page purging |
| **Graceful Shutdown** | Clean server shutdown handler for zero-downtime deploys |

---

## 🔄 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main` and `develop`:

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────┐
│ Code Quality │────→│    Build     │────→│  Deploy Staging   │
│  (Type Check │     │  (Next.js    │     │  (develop branch) │
│   + Lint)    │     │   bundle)    │     └───────────────────┘
└──────────────┘     └──────┬───────┘
                            │
┌──────────────┐            │         ┌───────────────────┐
│  Security    │────────────┴────────→│ Deploy Production │
│  (npm audit  │                      │  (main branch)    │
│   + secrets) │                      └───────────────────┘
└──────────────┘
```

### Pipeline Jobs
1. **Code Quality** — TypeScript type-checking (`tsc --noEmit`) + ESLint
2. **Security Audit** — `npm audit` for vulnerability scanning + secret exposure detection
3. **Build** — Full Next.js production build with bundle size reporting
4. **Deploy Staging** — Auto-deploy `develop` branch to staging
5. **Deploy Production** — Auto-deploy `main` branch to production

---

## 🚀 Deployment

### AWS Amplify (Production)

The web application is deployed on **AWS Amplify** with the configuration in `amplify.yml`:

- Automatic builds triggered on Git push
- Environment variables injected at build time
- Static asset caching with immutable headers (`max-age=31536000`)
- HTML pages served with no-cache headers for freshness
- Production URL: `https://main.dc643n4iwffih.amplifyapp.com`

### Docker

```bash
# Development (hot-reloading)
docker compose up app-dev

# Production (optimized build)
docker compose up --build app

# Stop all containers
docker compose down
```

### Vercel (Alternative)

```bash
# Configuration in vercel.json
vercel --prod
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20 LTS
- **npm** 9+
- **MongoDB** instance (Atlas or local)
- **AWS S3** bucket (for image storage)
- **Upstash Redis** (for rate limiting)

### Web Application

```bash
# 1. Clone the repository
git clone git@github.com:vs1492/ViralFabrics.git
cd ViralFabrics

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# 4. Create the master admin user
npm run create-master

# 5. Start the development server
npm run dev

# 6. Open http://localhost:3000
```

### Mobile Application

```bash
# 1. Navigate to mobile app directory
cd mobile-app

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.staging .env
# Edit .env with your API URL

# 4. Start Expo development server
npx expo start

# 5. Scan QR code with Expo Go or run on emulator
npx expo run:android   # Android
npx expo run:ios       # iOS
```

### Build Mobile APK

```bash
cd mobile-app

# Preview APK (internal testing)
npx eas-cli build --platform android --profile preview

# Production build
npx eas-cli build --platform android --profile production

# OTA update (no new build required)
npm run update:production
```

---

## 🔐 Environment Variables

### Web Application (`.env`)

| Variable | Description |
|:---|:---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `NODE_ENV` | Environment (`development` / `production`) |
| `S3_ACCESS_KEY_ID` | AWS S3 access key |
| `S3_SECRET_ACCESS_KEY` | AWS S3 secret key |
| `S3_BUCKET_NAME` | AWS S3 bucket name |
| `S3_REGION` | AWS S3 region |
| `NEXTAUTH_SECRET` | NextAuth secret (if applicable) |
| `NEXTAUTH_URL` | Application URL |
| `NEXT_PUBLIC_APP_URL` | Public-facing application URL |

### Mobile Application (`mobile-app/.env`)

| Variable | Description |
|:---|:---|
| `EXPO_PUBLIC_API_URL` | Backend API URL (Amplify production or `http://local-ip:3000`) |

---

## 📜 Scripts Reference

### Web Application

| Script | Command | Description |
|:---|:---|:---|
| `dev` | `npm run dev` | Start development server with Socket.IO |
| `build` | `npm run build` | Production build |
| `start` | `npm start` | Start production server |
| `type-check` | `npm run type-check` | TypeScript type validation |
| `lint` | `npm run lint` | ESLint code analysis |
| `lint:fix` | `npm run lint:fix` | Auto-fix lint issues |
| `format` | `npm run format` | Prettier formatting |
| `create-master` | `npm run create-master` | Create master admin user |
| `health-check` | `npm run health-check` | Verify server health |

### Mobile Application

| Script | Command | Description |
|:---|:---|:---|
| `start` | `npm start` | Start Expo dev server |
| `android` | `npm run android` | Run on Android device/emulator |
| `ios` | `npm run ios` | Run on iOS simulator |
| `build` | `npm run build` | Type-check + Expo export |
| `test` | `npm test` | Run Jest test suite |
| `update:staging` | `npm run update:staging` | Push OTA update to staging channel |
| `update:production` | `npm run update:production` | Push OTA update to production channel |

---

## 🤝 Contributing

1. Create a feature branch from `develop`:
   ```bash
   git checkout -b feature/your-feature develop
   ```
2. Commit changes with clear, descriptive messages
3. Ensure `npm run type-check` passes with zero errors
4. Push and create a Pull Request to `develop`
5. After review and approval, merge to `develop` for staging deployment
6. Promote to `main` for production release

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  <strong>Built with ❤️ by the Viral Fabrics Team</strong>
</p>