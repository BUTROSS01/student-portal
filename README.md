# Tshwane City College — Student & Parent Portal

A complete student management and parent-portal system for Tshwane City
College: students, parents/guardians, lecturers, academic administrators,
finance staff, management, and system administrators, all served from one
role-based platform.

See `/docs/ARCHITECTURE.md` for the full system blueprint — tech stack
rationale, database schema and ERD, roles/permissions matrix, API/security/
deployment architecture, and the module-by-module roadmap.

## What's built

All 12 modules from the roadmap have a working backend API, and every one
has at least one real, functioning frontend screen exercising its core
workflow:

| Module | Backend | Frontend |
|---|---|---|
| 1. Authentication & User Management | Login, JWT + refresh rotation, 2FA, lockout, admin user CRUD, audit log | Login page, session handling, role-routed dashboards |
| 2. Student Management | Registration, profile, search, parent linking | Registration form, student list, profile on dashboards |
| 3. Academic Management | Campuses, departments, programmes, subjects, classes, enrolment | Institution Setup (Super Admin), Classes (Academic Admin) |
| 4. Results | Draft → submit → approve/reject → publish, `ResultHistory` audit trail, transcripts | Marks Entry (Lecturer), Results Review (Academic Admin) |
| 5. Fees | Fee accounts, balance tracking | Create Fee (Finance), fee summary on Student/Parent dashboards |
| 6. Payments | Submission, verification, receipts, balance updates | Submit Payment (Student), Verify Payments (Finance) |
| 7. Communication | Announcements (audience-targeted fan-out), messages, in-app notifications | Announcements page, Notifications feed (all roles) |
| 8. Documents | Upload/list/download, access-controlled by student ownership | Documents page (Student); used internally by Payments proof upload |
| 9. Attendance | Bulk daily marking, percentage calculation, low-attendance alerts | Attendance Marking (Lecturer) |
| 10. Timetables | Class/exam schedule entries | Timetable view (Student/Lecturer) |
| 11. Reporting | Student register, fee collection, academic performance, attendance — JSON or CSV | Reports page (Academic Admin/Finance/Management) |
| 12. Administration | Audit log, read-only effective settings | Audit Log viewer (Super Admin) |

**Honestly still API-only** (the endpoint works; there's no dedicated
screen yet): subject-level enrolment (`POST /api/enrolments`), learning
materials and assignment submission (the `LearningMaterial` and
`Assignment` tables exist but have no controller yet), and a couple of
nav links inherited from early scaffolding (`/lecturer/materials`,
transcript download UI) that point at real data but not a built page.
None of this is hidden — see `ARCHITECTURE.md`'s roadmap section for the
full, current list of deliberate scope limits.

## Repository layout

```
backend/    Node.js + Express + TypeScript + Prisma API
frontend/   React + Vite + TypeScript + Tailwind CSS web app
docs/       Architecture blueprint and reference diagrams
```

## Getting started

### Prerequisites

- Node.js 20 LTS or later
- A PostgreSQL 15+ database (local, or a managed instance such as Neon,
  Supabase, or Amazon RDS)

### 1. Backend API

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL to your Postgres instance, and generate
# real secrets for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, e.g.:
#   openssl rand -base64 48

npm install
npx prisma migrate dev --name init   # creates all tables
npx prisma db seed                   # creates the 7 roles + a starter admin account
npm run dev                          # starts the API on http://localhost:4000
```

Uploaded documents (proof of payment, etc.) are written to `./uploads` by
default — see `src/utils/storage.util.ts` for why, and how to swap in an
S3-compatible bucket for production.

The seed script prints a one-time Super Admin login
(`admin@tshwanecitycollege.ac.za`) — sign in with it once, then use the
Users module to create real staff accounts, and change that password
immediately (the account is flagged to force this on first login).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # starts the web app on http://localhost:5173
```

The dev server proxies `/api` requests to the backend, so both must be
running for login to work.

### 3. A first end-to-end walkthrough

1. Sign in as the seeded Super Admin → **Institution Setup**
   (`/admin/structure`): add a campus, a department, a programme, and a
   subject.
2. **Users & roles**: create a Lecturer and a Finance account
   (`POST /api/users` — each gets a temporary password printed back once).
3. Sign in as Academic Admin (or Super Admin) → **Student registration**:
   register a student, assigning the programme/campus you just created.
4. **Classes**: create a class in that programme/campus and assign the
   Lecturer.
5. Allocate the student to the subject: `POST /api/enrolments` (no screen
   yet — see "honestly still API-only" above).
6. Sign in as the Lecturer → **Marks entry**: enter and submit a mark for
   that student. **Attendance**: mark the class present/absent for a day.
7. Sign in as Academic Admin → **Results review**: approve and publish
   the result.
8. Sign in as the student → see the published result, attendance
   percentage, and (once Finance creates a fee account and the student
   submits a payment) the fee balance, all on one dashboard.
9. Sign in as Finance → **Create fee**, then **Payments awaiting
   verification** to confirm the student's submission — this updates the
   balance and issues a receipt automatically.

Every account is forced to change its temporary password on first login.

## What's next

The architecture, schema, and API surface for all 12 modules are in
place. From here, the highest-value next steps are the "honestly still
API-only" items above, plus wiring a real email/SMS provider behind the
notification interface already in place (`notify.util.ts`) once the
college has provider credentials to configure.
