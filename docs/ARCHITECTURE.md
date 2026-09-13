# Tshwane City College Student & Parent Portal — System Architecture & Implementation Blueprint

This document is the reference blueprint for the platform: architecture,
technology choices, database design, roles, workflows, and the roadmap for
building out every module. The database schema itself lives in
`backend/prisma/schema.prisma`; this document explains and contextualises it.

---

## 1. System Architecture Overview

The system is a **three-tier web application**:

```
┌─────────────────────────┐      HTTPS / JSON       ┌──────────────────────────┐      SQL      ┌──────────────┐
│   React (Vite) Web App  │  ───────────────────►   │  Node.js / Express API   │  ──────────►  │  PostgreSQL  │
│  (students, parents,    │  ◄───────────────────   │  (stateless, horizontally │  ◄──────────  │  (single     │
│   staff — role-routed)  │   REST + JWT             │   scalable)              │    Prisma      │   source of  │
└─────────────────────────┘                          └──────────────────────────┘    ORM         │   truth)    │
                                                               │        │                          └──────────────┘
                                                               │        └──────► Object storage (S3-compatible)
                                                               │                  for documents, receipts, proofs
                                                               └───────────────► Email / SMS providers
                                                                                  for notifications
```

Design principles that shape every module:

- **One relational database.** Academic, financial, and attendance records
  are deeply cross-referential (a fee links to a student links to a
  programme links to results) — this is a poor fit for document/NoSQL
  storage, and referential integrity (a payment can never point at a
  non-existent student) matters more here than schema flexibility.
- **Stateless API.** No session state is held in server memory; every
  request carries a JWT. This means the API can run as multiple identical
  instances behind a load balancer with no sticky sessions.
- **Files never touch the database.** Documents, proofs of payment, and
  receipts are stored in object storage; the database holds only metadata
  and a storage key. Keeps the database small, backups fast, and scales
  file storage independently.
- **Every write that matters is audited.** Result changes, payment
  verification, and account changes all write to `AuditLog` (or, for
  results specifically, the more detailed `ResultHistory`) in the same
  transaction as the change itself.

---

## 2. Technology Stack

| Layer | Choice | Alternatives considered |
|---|---|---|
| Database | **PostgreSQL** | MySQL, Firebase (Firestore), Supabase |
| Backend | **Node.js + Express + TypeScript** | Laravel (PHP), Django (Python) |
| ORM | **Prisma** | TypeORM, Sequelize, raw SQL |
| Frontend | **React + Vite + TypeScript + Tailwind CSS** | Next.js |
| Auth | **JWT (access + rotating refresh tokens), bcrypt, TOTP 2FA** | Session cookies only, third-party auth (Auth0/Firebase Auth) |
| File storage | **S3-compatible object storage** (AWS S3 / Cloudflare R2 / Supabase Storage) | Database BLOBs, local disk |
| Email | **Resend or SendGrid** | Self-hosted SMTP |
| SMS | **Clickatell, BulkSMS, or Twilio** (SA-friendly gateways) | — |
| Hosting | **Managed Postgres + containerised API on Render/Railway + static frontend on Vercel/Netlify**, or fully self-hosted via Docker Compose on a college-owned VPS | Fully serverless (Vercel functions + Supabase) |

### Why this stack

**PostgreSQL over MySQL:** functionally close, but Postgres's native
`Decimal`/`Numeric` types (used throughout the Fees/Results models),
stronger JSON support (used in `AuditLog.metadata` and
`ResultHistory.previousValue`/`newValue`), and row-level security options
for future multi-campus data isolation make it the better long-term fit.

**PostgreSQL over Firebase/Firestore:** this system is fundamentally
relational — a transcript is a join across Student, Enrolment, Subject,
and Result. Firestore's document model forces either heavy
denormalisation (which then has to be kept consistent by hand) or
expensive multi-read client-side joins. It's the wrong tool for a
system whose core value is trustworthy cross-referenced records.

**Node/Express/TypeScript over Laravel or Django:** all three are
legitimate choices. Node/TypeScript was chosen because:
1. One language (TypeScript) end-to-end, frontend and backend, which
   matters for a system a small college IT team will maintain long-term.
2. Prisma's generated types mean a schema change is caught by the
   compiler everywhere it's used, before it reaches production.
3. Very large developer pool in South Africa and globally, which matters
   for "long-term sustainability" and future hand-offs between developers.

Django is a strong runner-up — its built-in admin panel would give
Super Admins a free back-office UI — but building the *specific* RBAC
model this system needs (7 roles, fine-grained permissions, parent-student
linking) ends up requiring about as much custom code either way, and
Django's admin panel doesn't easily become the *public-facing* student
and parent experience this brief calls for.

**Prisma over a raw SQL / TypeORM:** Prisma's migration history
(`prisma/migrations/`) gives an auditable, reviewable trail of every
schema change — valuable for a system holding financial and academic
records — and its generated client makes the kind of relational queries
this system needs (a student's full academic history in one call)
straightforward and type-safe.

**React + Vite over Next.js:** Next.js is a fine alternative, but this
system is a *pure application* behind a login wall (no public marketing
pages, no SEO requirement), so Next.js's server-rendering and routing
machinery adds complexity without a matching benefit here. A clean
separation between a REST API (reusable by a future mobile app) and a
Vite-built single-page app keeps both sides simpler.

**Supabase as a fallback/accelerator option:** if the college has very
limited in-house development capacity, Supabase (hosted Postgres + Auth +
Storage + Row-Level Security) can replace the custom Express backend for
faster delivery, at the cost of some vendor coupling (mitigated by
Supabase being open-source and self-hostable). The schema in this
repository is portable to that path with minimal changes, since it's
already plain PostgreSQL.

---

## 3. Database Architecture

The full schema is defined in `backend/prisma/schema.prisma` (the single
source of truth — always check that file for current field names and
types). It is organised into six groups:

1. **Identity & access** — `Role`, `Permission`, `RolePermission`, `User`, `RefreshToken`
2. **Institution structure** — `Campus`, `Department`, `Programme`, `Subject`, `Class`
3. **People** — `Student`, `ParentGuardian`, `StudentParentLink`, `Staff`
4. **Academics** — `Enrolment`, `Examination`, `Result`, `ResultHistory`, `Attendance`, `LearningMaterial`, `Assignment`, `AssignmentSubmission`
5. **Finance** — `Fee`, `Payment`, `PaymentProof`, `Receipt`, `Statement`
6. **Documents & communication** — `Document`, `Announcement`, `Message`, `Notification`, `Timetable`, `AuditLog`

Key design decisions:

- **`ResultHistory` is append-only.** Every edit to a `Result` inserts a
  row recording `previousValue`, `newValue`, who changed it, and why — the
  `Result` row itself always reflects the current state, but nothing about
  its past is ever overwritten or deleted.
- **`StudentParentLink` is an explicit join table**, not a simple foreign
  key, because a student can have more than one linked guardian (and,
  rarely, a guardian more than one linked student) — the `isPrimary` flag
  and `relationship` field support building a proper parent-access UI
  later without a schema change.
- **Money fields use `Decimal(10,2)`**, never floating point, to avoid
  cent-level rounding errors accumulating across thousands of fee
  transactions.
- **Soft status over hard delete.** Users are `DEACTIVATED`, not deleted —
  every record they ever touched (a result they entered, a payment they
  verified) needs to remain attributable for audit purposes.
- **A `Class` is a cohort, not a subject-specific session.** `Class`
  carries one `lecturerId` and belongs to one `Programme`, modelling a
  student group (e.g. "IT Year 1 Group A") rather than a single subject's
  timetable slot. Module 4 (Results) scopes what a Lecturer may grade from
  this: a student in their class, in a subject that belongs to that
  class's programme, who holds an active `Enrolment` for it. This is
  simpler than a full per-subject teaching-assignment model and is the
  known simplification to revisit if the college needs multiple lecturers
  teaching different subjects to the same cohort — the fix would be a
  `ClassSubjectLecturer` join table, not a change to the tables already
  built.

## 4. Entity Relationship Diagram (core relationships)

```mermaid
erDiagram
    ROLE ||--o{ USER : "assigned to"
    USER ||--o| STUDENT : "is a"
    USER ||--o| PARENT_GUARDIAN : "is a"
    USER ||--o| STAFF : "is a"
    STUDENT }o--o{ PARENT_GUARDIAN : "linked via StudentParentLink"
    PROGRAMME ||--o{ STUDENT : enrols
    PROGRAMME ||--o{ SUBJECT : offers
    STUDENT ||--o{ ENROLMENT : has
    SUBJECT ||--o{ ENROLMENT : "enrolled in"
    STUDENT ||--o{ RESULT : receives
    RESULT ||--o{ RESULT_HISTORY : "audited by"
    STUDENT ||--o{ ATTENDANCE : has
    CLASS ||--o{ ATTENDANCE : records
    STAFF ||--o{ CLASS : teaches
    STUDENT ||--o{ FEE : owes
    FEE ||--o{ PAYMENT : "paid via"
    PAYMENT ||--o| PAYMENT_PROOF : evidenced_by
    PAYMENT ||--o| RECEIPT : generates
    STUDENT ||--o{ DOCUMENT : owns
```

*(This is a simplified view for readability — see `schema.prisma` for the
complete set of ~30 entities, including `Campus`, `Department`,
`Examination`, `Timetable`, `Announcement`, `Message`, `Notification`, and
`AuditLog`.)*

---

## 5. User Roles & Permissions Matrix

| Capability | Super Admin | Management | Academic Admin | Lecturer | Finance | Student | Parent |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage user accounts & roles | ✅ | — | — | — | — | — | — |
| Configure campuses/programmes/subjects | ✅ | — | View | — | — | — | — |
| Register students | ✅ | — | ✅ | — | — | — | — |
| Enter marks | — | — | — | ✅ (own classes) | — | — | — |
| Approve & publish results | — | — | ✅ | — | — | — | — |
| View own results | — | — | — | — | — | ✅ | ✅ (linked student) |
| Take attendance | — | — | — | ✅ (own classes) | — | — | — |
| View attendance stats | View all | View all | View all | Own classes | — | Own | Linked student |
| Create fee accounts | — | — | — | — | ✅ | — | — |
| Verify payments | — | — | — | — | ✅ | — | — |
| Upload proof of payment | — | — | — | — | — | ✅ | ✅ (linked student) |
| View institutional KPIs | ✅ | ✅ | Department-level | — | Finance-level | — | — |
| Publish announcements | ✅ | ✅ | Programme-level | Class-level | — | — | — |
| Access audit logs | ✅ | — | — | — | — | — | — |

This table is the source for the `Permission`/`RolePermission` seed data —
each ✅ becomes a `permission.code` scoped to that `RoleName` (see
`backend/prisma/seed.ts` for the starter set; it grows with each module).

---

## 6. Complete Feature List (by module)

| Module | Core features |
|---|---|
| Authentication & User Management | Login, JWT session, 2FA, password policy & lockout, admin user CRUD, audit logging |
| Student Management | Registration, profile, programme/subject allocation, document vault |
| Academic Management | Programmes, subjects, classes, enrolment, academic calendar |
| Results | Manual entry, CSV import, approval workflow, publication, transcripts, `ResultHistory` |
| Fees | Fee account creation, balance tracking, statements |
| Payments | Proof upload, verification workflow, receipts, payment-gateway-ready architecture |
| Communication | Announcements (targeted by audience), internal messaging, email/SMS/in-app notifications |
| Documents | Centralised, categorised, versioned document repository with access control |
| Attendance | Daily marking, percentage calculation, threshold alerts |
| Timetables | Student/lecturer/room/exam timetables |
| Reporting | Cross-module search, exportable reports (PDF/Excel/CSV) |
| Administration | Campus/department/programme config, system settings, backups, activity logs |

## 7. Page-by-Page Portal Structure (by role)

- **Student:** Dashboard → Results → Fees & Payments → Attendance →
  Timetable → Assignments & Materials → Documents → Announcements →
  Messages → Profile Settings
- **Parent:** Dashboard → Linked Students (switcher if more than one) →
  Results → Fees & Payments → Attendance → Announcements → Messages
- **Lecturer:** My Classes → Class Roster → Attendance Entry → Marks Entry
  → Materials Upload → Assignments → Class Announcements
- **Finance:** Overview → Payments Awaiting Verification → Outstanding
  Accounts → Receipts & Statements → Reports
- **Academic Admin:** Overview → Student Registration → Enrolment →
  Results Review & Publication → Transcripts → Progression → Exam
  Scheduling
- **Management:** Institutional KPIs → Academic Performance → Fee
  Collection → Attendance → Departmental Reports → Announcements
- **Super Admin:** Overview → Users & Roles → Campuses & Departments →
  Programmes & Subjects → Academic Calendar → Audit Log → System Settings
  → Backups

## 8. Navigation Structure

Every role shares the same shell (persistent left sidebar + top-level page
title + content area — see `DashboardLayout` in the frontend), but the
sidebar's link set is role-specific and generated from that role's page
list above (`ROLE_DASHBOARD_PATH` / per-dashboard `NAV` arrays in the
codebase). This keeps navigation predictable across roles while ensuring
nobody sees a link to a page they can't access — the frontend nav and the
backend's `authorize()` middleware are driven from the same roles-matrix
source of truth.

---

## 9. User Workflows

**Student registration**
```
Application → Admission decision → Student number issued →
Programme & subjects allocated → Registration confirmed → Fee account created → Active student
```

**Results**
```
Lecturer enters marks (status: DRAFT/SUBMITTED)
  → Academic Admin reviews (UNDER_REVIEW)
    → Approved → PUBLISHED → Student & Parent notified
    → Rejected → back to Lecturer with a reason (recorded in ResultHistory)
```

**Payment verification**
```
Student/Parent submits payment + uploads proof
  → Fee status: SUBMITTED → UNDER_VERIFICATION
  → Finance reviews the proof document
    → Confirmed → Fee.amountPaid updated → Receipt generated → Student & Parent notified
    → Rejected → Student & Parent notified with a reason, resubmission allowed
```

**Attendance alerting**
```
Lecturer records attendance
  → System recalculates the student's attendance percentage
    → Below configured threshold → Notification queued for Student, Parent, and Academic Admin
```

**Communication**
```
Authorised staff drafts an announcement → selects audience (student / parent / class / programme / department / campus / college-wide)
  → Publish → Notification fan-out (in-app + email, SMS where configured) → Read receipts tracked per recipient
```

---

## 10. API Architecture

- **Style:** REST over JSON, versioned implicitly via `/api/` for now
  (moves to `/api/v1/` if a breaking change is ever needed after external
  consumers — e.g. a future mobile app — exist).
- **Auth:** `Authorization: Bearer <accessToken>` header on every
  protected request; the refresh token travels only as an `httpOnly`,
  `Secure`, `SameSite=Strict` cookie scoped to `/api/auth`, so it is never
  reachable from JavaScript.
- **Conventions:** plural resource nouns (`/api/users`, `/api/students`),
  standard HTTP verbs and status codes, pagination via `page`/`pageSize`
  query params, filtering via query params validated against a Zod schema
  per endpoint.
- **Error shape:** `{ "error": "message", "details"?: {...} }` for every
  4xx/5xx response, produced by one central `errorHandler` — no endpoint
  hand-rolls its own error format.
- **Module boundary:** each module owns its own `routes/`, `controllers/`,
  and `validators/` files and is mounted independently in
  `routes/index.ts` (see the commented-out future routes there) — modules
  do not import each other's controllers, only shared `utils/` and the
  Prisma client.

## 11. Security Architecture

- **Authentication:** bcrypt (cost factor 12) password hashing, JWT
  access tokens (15 min) + rotating refresh tokens (7 days, revoked and
  reissued on every use), optional TOTP-based 2FA (`otplib`).
- **Account protection:** lockout after a configurable number of failed
  attempts (`MAX_FAILED_LOGIN_ATTEMPTS`, default 5) for a configurable
  window (`LOCKOUT_MINUTES`), independent of IP-based rate limiting on the
  login endpoint itself.
- **Authorization:** role-based via `authorize(...roles)` middleware for
  coarse checks; fine-grained rules (e.g. "a lecturer may only enter marks
  for their own classes") are enforced inside each controller against the
  `RolePermission`/`Permission` tables and the requester's own
  associations (their `Class`, their `Campus`).
- **Input handling:** every request body validated against an explicit
  Zod schema before it reaches a controller — nothing unvalidated reaches
  Prisma (which itself uses parameterised queries, closing off SQL
  injection) or gets echoed back to a client (closing off reflected XSS).
- **Transport & headers:** `helmet()` for standard security headers, CORS
  locked to the known frontend origin, CSRF risk minimised structurally by
  keeping the refresh token in a `SameSite=Strict` cookie and requiring an
  explicit Bearer header (not a cookie) for the access token.
- **Audit trail:** every login attempt, password change, user-management
  action, and result/payment change writes to `AuditLog` (or
  `ResultHistory`) with who/when/what/from-where.
- **Data protection (POPIA):** as a South African institution, the college
  is subject to the Protection of Personal Information Act. Practically,
  this means: role-based access is the default posture (nobody sees more
  than their role needs), sensitive documents live in access-controlled
  object storage rather than public URLs, and the audit log itself
  provides the record-of-processing evidence POPIA compliance reviews
  typically ask for. A formal POPIA compliance review (data processing
  agreements with hosting/email/SMS providers, a documented retention
  policy, a designated Information Officer) sits alongside this technical
  blueprint as an institutional, not purely technical, task.

## 12. File Storage Architecture

- Files (documents, proofs of payment, receipts, learning materials) are
  stored in an S3-compatible bucket, never in the database.
- The `Document` table stores only `storageKey`, `mimeType`, `sizeBytes`,
  `version`, and `status` — the bucket is the source of truth for bytes,
  Postgres for metadata and access control.
- Uploads and downloads use short-lived signed URLs generated by the API,
  so the bucket itself can remain fully private.
- `version` on `Document` supports superseding a file (e.g. a corrected
  transcript) without losing the previous version's audit trail.

## 13. Notification Architecture

- Three channels, modelled explicitly: `IN_APP`, `EMAIL`, `SMS`
  (`NotificationChannel` enum), each producing a `Notification` row with
  its own `readAt` tracking.
- A single "notify user X about event Y" internal service fans out to
  whichever channels are configured for that event and that user's
  preferences — callers (e.g. the payment-verification controller) call
  one function, not three.
- SMS uses a South Africa-friendly gateway (Clickatell/BulkSMS) behind a
  thin provider-agnostic interface, so switching providers later doesn't
  touch calling code.

## 14. Payment Architecture

- Payment statuses form a strict progression: `PENDING → SUBMITTED →
  UNDER_VERIFICATION → CONFIRMED` (or `REJECTED` at the verification
  step), with `PARTIALLY_PAID`/`PAID_IN_FULL` tracked at the `Fee` level
  as `amountPaid` accumulates across `Payment` rows.
- Today, "payment" means "upload proof, Finance verifies manually" — this
  is deliberate given the brief's emphasis on proof-of-payment workflows
  over live gateway integration.
- The architecture is gateway-ready: a future `PaymentGatewayWebhook`
  handler would create the same `Payment` row and drive it straight to
  `CONFIRMED` on a verified webhook callback, reusing every downstream
  step (balance update, receipt generation, notification) unchanged.

## 15. Reporting Architecture

- Reports are generated on-demand from the relational data (no separate
  data warehouse needed at this scale — thousands, not millions, of
  students).
- Each report type (student register, fee collection, outstanding fees,
  academic performance, attendance, results, payment verification,
  progression) is a parameterised query plus a formatter; PDF export uses
  a server-side templating/rendering step, Excel/CSV are generated
  directly from the same query result set so all three formats are
  always in sync.
- Heavy or cross-campus reports (e.g. institution-wide KPIs for
  Management) are candidates for a materialised view or a nightly summary
  table if query time becomes noticeable — not needed at launch scale.

## 16. Deployment Architecture

Two supported paths, both using the same codebase:

1. **Managed cloud (fastest to stand up):** frontend on Vercel/Netlify;
   API as a container on Render/Railway; database on a managed Postgres
   provider (Neon, Supabase, or similar) with automated backups;
   object storage on Cloudflare R2 or AWS S3.
2. **Self-hosted (full institutional control):** a single Docker Compose
   stack (API container + Postgres container + a reverse proxy such as
   Caddy/Nginx handling TLS) on a college-owned or -leased VPS, with the
   frontend built as static files served by the same proxy. This path
   suits institutions with data-residency or POPIA-driven preferences to
   keep everything on infrastructure they directly control.

Both paths use the same environment-variable-driven configuration
(`.env`), so moving between them later is a redeploy, not a rewrite.

## 17. Backup Strategy

- **Database:** automated daily full backups plus continuous
  write-ahead-log (WAL) archiving where the hosting provider supports it
  (point-in-time recovery), retained for a rolling 30 days at minimum;
  monthly backups retained for a full academic year for audit purposes.
- **Object storage:** versioning enabled on the bucket, plus cross-region
  replication for disaster recovery of documents/receipts.
- **Restore drills:** a documented, periodically-tested restore procedure
  — an untested backup is not a backup.

## 18. Testing Strategy

- **Unit tests** (Vitest) for pure logic: password policy, grade/pass-fail
  calculation, attendance percentage calculation, token utilities.
- **Integration tests** for each API endpoint against a real (test)
  Postgres database: the auth flow (login, lockout, refresh rotation,
  2FA), and RBAC boundaries (a Lecturer token must be rejected by
  Super-Admin-only routes, etc.).
- **Security-focused tests:** brute-force lockout behaviour, JWT
  expiry/tampering rejection, input-validation edge cases (oversized
  payloads, malformed emails, SQL-injection-shaped strings that Prisma
  should neutralise regardless).
- **End-to-end tests** (once enough modules exist to matter) for the four
  critical workflows in Section 9: registration, results publication,
  payment verification, and communication fan-out.

## 19. Development Roadmap

Each module follows the same delivery pattern established by Module 1:
Prisma models already exist → routes/controllers/validators →
frontend screens → tests.

| # | Module | Depends on | Status |
|---|---|---|---|
| 1 | Authentication & User Management | — | **Built** (this repository) |
| 2 | Student Management | Module 1 | **Built** (this repository) |
| 3 | Academic Management (programmes, subjects, classes, enrolment) | Module 2 | **Built** (this repository) |
| 4 | Results | Module 3 | **Built** (this repository) |
| 5 | Fees | Module 2 | **Built** (this repository) |
| 6 | Payments | Module 5 | **Built** (this repository) |
| 7 | Communication | Module 1 | **Built** (this repository) |
| 8 | Documents | Module 2 | **Built** (this repository) |
| 9 | Attendance | Module 3 | **Built** (this repository) |
| 10 | Timetables | Module 3 | **Built** (this repository) |
| 11 | Reporting | Modules 2–10 | **Built** (this repository) |
| 12 | Administration (campuses/departments/settings/backups UI) | Module 1 | **Built** (this repository) — settings view is read-only; see note below |

All twelve modules now have a working backend API. Frontend coverage is
real but not exhaustive — every module has at least one working screen
exercising its core workflow (see the README's "What's built" section for
the honest list of which secondary screens — transcripts UI, learning
materials, assignment submission — are still API-only).

**Deliberate scope limits, not oversights:**
- **System settings are read-only.** They're env-variable-driven (see
  `.env.example`), not stored in a database table, so there's nothing yet
  to edit from the UI without a redeploy. A `SystemSetting` table is the
  natural next step if runtime editing is needed.
- **Backups are documented, not automated by this codebase.** Section 17
  (Backup Strategy) describes the policy; actually scheduling it is a
  hosting-provider/ops task (managed Postgres backups, or a cron'd
  `pg_dump` on a self-hosted box), not application code.
- **Email/SMS notifications are modelled but not connected.** Every
  workflow that should notify someone (results published, payment
  verified, low attendance, a rejected submission) creates a real in-app
  `Notification` row — see Module 7 — but the `EMAIL`/`SMS` channels in
  the schema have no provider wired up, because that needs a real
  Resend/SendGrid/Twilio/Clickatell account and credentials this
  environment can't hold on the college's behalf.
- **Document storage is local disk, not S3.** Deliberately — see
  `storage.util.ts` — so the Documents and Payments modules work the
  moment someone runs `npm install`, with a clearly marked swap point for
  production.
