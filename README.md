# LIFE INSURANCE CORE SYSTEM
### Enterprise Core Platform &bull; Individual Life & Group Life Administration
**Phase 1: Login Screen, Oracle Authentication and Dummy Dashboard**

---

## 1. Project Overview

The **Life Insurance Core System** is an enterprise-grade platform designed for end-to-end administration of Individual Life and Group Life insurance portfolios. 

Phase 1 establishes the foundational architecture:
- **Enterprise Login Screen**: Modern two-column interface with branding panel and secure form.
- **Oracle 19c Authentication**: Database authentication leveraging the existing `KINS.MTBL_USER` table.
- **Secure Session Management**: Signed JSON Web Tokens (JWT) transmitted via `HttpOnly`, `SameSite=Lax` cookies.
- **Executive Life Insurance Dashboard**: Interactive dummy demonstration dashboard featuring 6 KPI cards, 3 Recharts data visualizations, a recent operations feed, and quick-access navigation.
- **Line of Business Navigation**: Dedicated placeholder modules for Individual Life (`/individual-life`) and Group Life (`/group-life`), plus 9 upcoming administrative modules.
- **Full Route Protection**: Strict client and server-side route guards and automatic session restoration.

---

## 2. Technical Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Lucide React, Recharts, React Hook Form, Zod |
| **Backend** | Node.js, Express, TypeScript, node-oracledb, bcrypt, jsonwebtoken, Zod, Helmet, express-rate-limit, cookie-parser |
| **Database** | Oracle Database 19c (Schema: `KINS`, Table: `MTBL_USER`) |
| **Architecture** | Three-layer Enterprise Architecture (Presentation &bull; API &bull; Oracle 19c Data Layer) |

---

## 3. Database Schema Overview

### A. Authentication & User Table (`KINS.MTBL_USER`)

| Col # | Column Name | Data Type | Nullable | Description & Role |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `USER_ID` | `VARCHAR2(20)` | Y | Primary login identifier / username |
| 2 | `USER_PASSWORD` | `VARCHAR2(50)` | Y | Password column (Length 50; supports legacy string or bcrypt) |
| 3 | `USER_NAME` | `VARCHAR2(255)` | Y | Full user display name |
| 4 | `USER_L1_DESC` | `VARCHAR2(255)` | Y | Department / secondary description |
| 5 | `USER_DISABLE_FLAG`| `VARCHAR2(1)` | Y | Account status: `'N'` = Active, `'Y'` = Disabled / Inactive |
| 6 | `USER_LOGIN_COUNT` | `NUMBER(4,0)` | Y | Login audit counter (auto-incremented on login) |
| 7 | `USER_CREATED_AT` | `DATE` | Y | Record creation timestamp |
| 8 | `USER_CREATED_BY` | `VARCHAR2(20)` | Y | Audit creator ID |
| 9 | `USER_MODIFIED_AT`| `DATE` | Y | Last modified timestamp |
| 10 | `USER_MODIFIED_BY`| `VARCHAR2(20)` | Y | Last modifier ID |

### B. Dynamic Menu Table (`KINS.MTBL_MENU`)

| Col # | Column Name | Data Type | Constraints | Description & Role |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `MENU_ID` | `VARCHAR2(50)` | PRIMARY KEY | Unique menu identifier (e.g. `DASHBOARD`, `USER_MANAGEMENT`) |
| 2 | `MENU_NAME` | `VARCHAR2(100)` | NOT NULL | Display label of the menu |
| 3 | `MENU_PARENT_ID` | `VARCHAR2(50)` | FK -> `MTBL_MENU` | Parent menu ID for nested hierarchical submenus |
| 4 | `MENU_SEQ_NO` | `NUMBER(4,0)` | NOT NULL | Sorting sequence number |
| 5 | `MENU_PATH` | `VARCHAR2(200)` | NULL | Frontend route URL |
| 6 | `MENU_ICON` | `VARCHAR2(50)` | DEFAULT `'Layers'` | Lucide icon identifier |
| 7 | `IS_ACTIVE` | `VARCHAR2(1)` | CHECK (`'Y'`, `'N'`) | Active toggle (Y=Active, N=Inactive) |
| 8 | `CREATED_BY` | `VARCHAR2(50)` | NULL | Audit creator user ID |
| 9 | `CREATED_AT` | `DATE` | DEFAULT `SYSDATE` | Creation timestamp |
| 10 | `MODIFIED_BY` | `VARCHAR2(50)` | NULL | Audit modifier user ID |
| 11 | `MODIFIED_AT` | `DATE` | NULL | Last modification timestamp |

*DDL and seed script located at:* `database/create_mtbl_menu.sql`

---

## 4. Administrative CRUD Operations & Database-Driven Navigation

### 1. Database-Driven Navigation
- The sidebar navigation is dynamically loaded from Oracle `KINS.MTBL_MENU` via `GET /api/menus?tree=true&activeOnly=true`.
- Supports hierarchical nested submenus (e.g. `Administration` contains `User Management` and `Menu Setup`).
- Updating, adding, or deleting a menu entry immediately propagates to the navigation layout in real time.

### 2. User Creation & Management Screen (`/administration/users`)
- **Read**: Search and filter users by User ID, Name, Department, and Active/Disabled status.
- **Create**: Add new users with User ID, Full Name, Department (`USER_L1_DESC`), Password, Confirm Password, and Status Flag (`USER_DISABLE_FLAG`).
- **Update**: Edit user details, department, active status, or optionally reset password.
- **Delete**: Remove user accounts from `MTBL_USER` with safeguards against self-deletion.

### 3. Menu Setup Screen (`/administration/menus`)
- **Read**: Tabular and hierarchical view of all configured menus, routes, sequence numbers, and Lucide icons.
- **Create**: Add new menu entries and submenus with Parent Menu selector, Sequence Number, Route Path, Lucide Icon, and Active Flag.
- **Update**: Edit existing menu entries, sequence numbers, routes, and icons.
- **Delete**: Delete menu entries with automatic child cleanup.

---

## 4. Project Directory Structure

```
d:/KINSUREPLUS/KINS/SOURCE/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AppLayout.tsx             # Responsive sidebar & header shell
│   │   │   ├── DashboardCharts.tsx       # Recharts area, donut & bar visualizations
│   │   │   ├── Header.tsx                # Breadcrumbs, search, user menu & logout
│   │   │   ├── LoginForm.tsx             # React Hook Form + Zod login form
│   │   │   ├── PasswordInput.tsx         # Show/hide password component
│   │   │   ├── ProtectedRoute.tsx        # Route authorization guard
│   │   │   ├── QuickAccess.tsx           # Quick navigation cards
│   │   │   ├── RecentActivities.tsx      # Illustrative operations table
│   │   │   ├── Sidebar.tsx               # Collapsible 12-module menu
│   │   │   └── StatCard.tsx              # KPI metric display with demo tag
│   │   ├── data/
│   │   │   └── dashboardMockData.ts      # Dedicated sample demonstration data
│   │   ├── hooks/
│   │   │   └── AuthContext.tsx           # Session management & user state
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx         # Executive dashboard
│   │   │   ├── GroupLifePage.tsx         # Group life placeholder & roadmap
│   │   │   ├── IndividualLifePage.tsx    # Individual life placeholder & roadmap
│   │   │   ├── LoginPage.tsx             # Two-column branded login screen
│   │   │   └── PlaceholderModulePage.tsx # Generic upcoming module placeholder
│   │   ├── services/
│   │   │   └── authService.ts            # Client-side API caller
│   │   ├── types/
│   │   │   ├── auth.ts                   # User & auth TypeScript models
│   │   │   └── dashboard.ts              # Dashboard metric & chart models
│   │   ├── App.tsx                       # React Router configuration
│   │   ├── index.css                     # Tailwind directives & styles
│   │   └── main.tsx                      # React root entrypoint
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts                    # Reverse proxy to backend API
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts               # Oracle connection pool & lifecycle
│   │   │   └── env.ts                    # Zod-validated environment config
│   │   ├── controllers/
│   │   │   └── authController.ts         # Login, /me, logout, health handlers
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts         # JWT cookie & header verification
│   │   │   └── errorHandler.ts           # Sanitized error handler (no SQL leak)
│   │   ├── repositories/
│   │   │   └── userRepository.ts         # Parameterized SQL queries on MTBL_USER
│   │   ├── routes/
│   │   │   └── authRoutes.ts             # Rate-limited auth routes
│   │   ├── services/
│   │   │   └── authService.ts            # Password verification & token issuance
│   │   ├── types/
│   │   │   └── user.ts                   # Oracle schema & safe profile types
│   │   ├── app.ts                        # Express app with Helmet, CORS & cookies
│   │   └── server.ts                     # Server bootstrap & graceful shutdown
│   ├── .env.example                      # Configuration template
│   ├── package.json
│   └── tsconfig.json
│
├── database/
│   └── inspection.sql                    # SQL*Plus data dictionary script
│
├── .gitignore
└── README.md
```

---

## 5. Configuration & Environment Variables

### Backend Configuration (`backend/.env`)

Create `backend/.env` using `backend/.env.example`:
```env
# Oracle Database 19c Configuration
ORACLE_USER=KINS
ORACLE_PASSWORD=your_kins_database_password
ORACLE_CONNECT_STRING=localhost:1521/orcl

# Application Configuration
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173

# Authentication & Security
JWT_SECRET=super_secret_enterprise_life_insurance_core_2026_jwt_token_key
JWT_EXPIRES_IN=15m
COOKIE_SECURE=false
```

---

## 6. How to Run the Application

### Prerequisites
- **Node.js**: v18+ (tested on Node v25.2.1)
- **Oracle Database 19c**: Listener running on `localhost:1521`, Service `orcl`

### Terminal 1: Start Backend API
```powershell
cd d:\KINSUREPLUS\KINS\SOURCE\backend
npm run dev
```
The backend starts at `http://localhost:5000` with the health check available at:
`http://localhost:5000/api/health`

### Terminal 2: Start Frontend Application
```powershell
cd d:\KINSUREPLUS\KINS\SOURCE\frontend
npm run dev
```
The frontend starts at:
`http://localhost:5173`

---

## 7. Security Features Implemented

1. **Parameterized Queries**: All SQL executions use Oracle bind parameters (`:userId`), preventing SQL injection.
2. **Password Verification**: Supports bcrypt (`$2...`) and legacy stored passwords while never exposing hashes or plaintext passwords in API responses or logs.
3. **Session Cookies**: Uses `HttpOnly`, `SameSite=Lax` cookies to prevent Cross-Site Scripting (XSS) token theft.
4. **Rate Limiting**: Brute-force protection on `/api/auth/login` (10 attempts per 15 minutes).
5. **Security Headers**: Powered by `helmet` to mitigate clickjacking, MIME sniffing, and cross-site leaks.
6. **Error Sanitization**: Centralized error middleware ensures Oracle internal error codes, SQL statements, and call stacks are never sent to the client.
7. **Account Status Verification**: Accounts with `USER_DISABLE_FLAG = 'Y'` are automatically rejected with a 403 Forbidden status.

---

## 8. Verification and Test Results

| Test Scenario | Expected Outcome | Result |
| :--- | :--- | :--- |
| **Inspect MTBL_USER** | Extract column definitions, nullability, constraints | **PASSED** (10 columns identified) |
| **Backend TypeScript Build** | `tsc` compiles with zero errors | **PASSED** |
| **Frontend Production Build** | Vite bundles production chunks without errors | **PASSED** (`dist/` generated) |
| **Unauthenticated Route Guard** | Opening `/dashboard` redirects to `/login` | **PASSED** |
| **Protected Module Redirection** | Direct URL to `/group-life` redirects to `/login` | **PASSED** |
| **Empty Input Validation** | Form displays inline errors for missing fields | **PASSED** (Zod & React Hook Form) |
| **Rate Limiter on Login** | Excessive attempts blocked after 10 requests | **PASSED** (HTTP 429 response) |
| **Password Show/Hide Toggle** | Toggles input visibility cleanly | **PASSED** |
| **Responsive Sidebar** | Collapses on desktop and toggles on mobile | **PASSED** |
| **Dashboard Demo Visuals** | 6 KPI cards, 3 Recharts graphs, and 5 activity items | **PASSED** |
| **Logout Workflow** | Clears session cookie and redirects to `/login` | **PASSED** |
