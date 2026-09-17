# Backend Specification — Event RSVP Backend

> Persistent architecture reference for coding agents. Describes the **actual current implementation**, not an idealized design. Last verified: 2026-08-14 against branch `illuminate-life`.

## 1. Project Overview

**What it is**: A single NestJS 11 backend service (`backend-event-rsvp`) that powers two related but independent event-management products out of one deployable app and one PostgreSQL database:

1. **Core RSVP system** (original product): invitation-only event registration, QR check-in, calendar files, email confirmations, optional Google Sheets sync. Consumed by a separate Next.js RSVP frontend and a separate admin dashboard frontend.
2. **Illuminate Life Gala system** (`src/modules/illuminate/`, added later): a ticket/sponsorship/branding booking system for one specific gala event, with its own seat inventory, sponsor tiers, and admin dashboard. Consumed by a third, separate frontend (`ILLUMINATE_FRONTEND_URL`).

Both subsystems live in the same NestJS app, share the same Postgres database (via one Prisma schema), and share the same auth module, email-sending pattern (Resend), and QR code library — but otherwise have almost no code-sharing and are aimed at different frontends. Treat them as two product domains inside one repo, not one unified domain model.

**Main consumers**: three external frontends (not in this repo) — the public RSVP site, an admin dashboard, and the Illuminate Life site/admin. None of the frontend code exists here; see `docs/FRONTEND_INTEGRATION.md` for the integration contract as of when it was written (verify against real frontend repos if available).

**Technology stack**:
- NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- PostgreSQL via Prisma ORM 5 (`@prisma/client`, `prisma`)
- `class-validator` / `class-transformer` for request DTOs (used inconsistently — see [§11](#11-coding-conventions))
- `jsonwebtoken` for JWT signing/verification (hand-rolled, not `@nestjs/jwt`)
- `resend` for transactional email (primary), raw HTML strings built inline in TS (no template engine)
- `qrcode` for QR code image generation
- `ics` for `.ics` calendar file generation
- `googleapis` for optional Google Sheets sync
- `@nestjs/throttler` for rate limiting
- Jest + `ts-jest` for unit tests, Supertest for e2e

**Runtime environment**: Node 20 (per `Dockerfile`), Express under the hood (`NestExpressApplication`), single process, no queue/worker infrastructure — background work (reminder emails) runs via a plain `setInterval` inside the same process (see [§9](#9-scheduler--background-work)).

## 2. Repository Architecture

```
backend-event-rsvp/
├── src/
│   ├── main.ts                    # Bootstrap: CORS, global ValidationPipe, global 'api' prefix, static file serving
│   ├── app.module.ts              # Root module — imports every feature module (Illuminate included)
│   ├── prisma/                    # PrismaService/PrismaModule — shared DB client, injected everywhere
│   └── modules/
│       ├── event/                 # Core: Event CRUD
│       ├── invite/                # Core: invite tokens, bulk create, reminder sending
│       ├── rsvp/                  # Core: RSVP submission orchestration (the central business flow)
│       ├── qr/                    # Core: QR image generation + validate/check-in
│       ├── admin/                 # Core: admin dashboard stats, CSV export, attendee/plus-one management
│       ├── calendar/              # Core: .ics file generation
│       ├── email/                 # Core: Resend wrapper + all core-system HTML email templates (inline)
│       ├── auth/                  # Shared: JWT login + RolesGuard/@Roles — used by BOTH subsystems
│       ├── sheets/                # Core (optional): Google Sheets sync, used by rsvp/qr/admin
│       ├── scheduler/              # Core: in-process interval loop for reminder emails
│       └── illuminate/            # Illuminate Life Gala subsystem (self-contained, see §2.1)
├── prisma/
│   ├── schema.prisma               # SINGLE SOURCE OF TRUTH — both subsystems' models live here
│   ├── schema-illuminate.prisma    # STALE reference file, NOT loaded by Prisma — see §14
│   ├── migrations/                 # One migration history for both subsystems
│   ├── seed.ts                     # Seeds one sample core Event + invites (does not seed Illuminate data)
│   └── *.sql                       # Ad hoc manual maintenance SQL (see §10)
├── public/email-images/            # Static assets served at /static/email-images/* for HTML emails
├── docs/                           # Feature-specific usage guides (see §15)
├── *.js (repo root)                # One-off Node maintenance scripts, run manually — see §10
├── docker-compose.yml, Dockerfile, entrypoint.sh   # Container build + migrate-then-start
└── .github/workflows/deploy.yml    # CI: build+push Docker image on push to `staging` only
```

### 2.1 The Illuminate subsystem in detail

```
src/modules/illuminate/
├── illuminate.module.ts        # imports PrismaModule, EmailModule, AuthModule, QrModule
├── README.md                   # Partially stale — documents a branding.controller.ts that doesn't exist (see §14)
├── controllers/
│   ├── booking.controller.ts   # Public booking creation + admin booking management (mixed public/admin routes, per-route guards)
│   ├── sponsor.controller.ts   # Public "active sponsors" listing + admin sponsor management
│   ├── seat.controller.ts      # Admin-only seat inventory management
│   ├── plus-one.controller.ts # Admin plus-one CRUD + public plus-one check-in
│   └── dashboard.controller.ts # Admin-only stats/activity-log/CSV export (class-level guard)
├── services/
│   ├── booking.service.ts      # Core logic: booking ID generation, seat auto-assignment algorithm, sponsor tier limits
│   ├── sponsor.service.ts
│   ├── seat.service.ts
│   ├── plus-one.service.ts
│   ├── activity-log.service.ts # Writes ActivityLog rows for audit trail (non-blocking, errors swallowed)
│   └── illuminate-email.service.ts  # Separate Resend wrapper; loads HTML from email-templates/*.html
├── dto/                        # class-validator DTOs (used consistently here, unlike core modules)
└── email-templates/*.html      # File-based templates with {{var}} / {{#if}} substitution (contrast with core's inline template strings)
```

There is **no `branding.controller.ts` or `BrandingService`** despite the `BrandingOpportunity` Prisma model existing and the module's own README documenting branding endpoints — branding inquiries currently have no HTTP surface in this codebase. Treat any reference to branding endpoints as aspirational/unverified.

## 3. Application Architecture

- **Pattern**: Modular monolith — one NestJS process, feature modules per domain, standard Nest layering (Controller → Service → PrismaService). No CQRS, no event bus, no microservices.
- **API style**: REST over Express, global prefix `/api` (set in `main.ts`), JSON bodies, no versioning scheme (no `/v1`).
- **Background work**: One in-process interval timer (scheduler module), not a cron library, not a queue.
- **No global exception filter, no global interceptor, no global guard** — request handling relies entirely on per-module/per-route decorators plus the one global `ValidationPipe`.

## 4. Domain Model

Two mostly-disjoint domain clusters share one `schema.prisma` (`prisma/schema.prisma`):

### 4.1 Core RSVP domain
- **Event** — one row per event; `capacity` / `currentRegistrations` counters are maintained manually by services (not DB triggers) inside `$transaction` blocks whenever attendees register/cancel.
- **Invite** — a single-use token (`token: String @unique`, UUID) tied to one `Event` and optionally one email. `isUsed`, `expiresAt`, `lastReminderSent`/`reminderCount` drive the reminder scheduler.
- **Attendee** — created from a successful RSVP submission; `status` is `CONFIRMED | WAITLISTED | CANCELLED`; `registrationId` format `REG-########` (last 8 digits of `Date.now()` — see [§14](#14-known-technical-debt-and-incomplete-work) for a collision-risk note); `qrCode` is a random hex string (not a signed/verifiable token).
- **PlusOne** — 1:1 with an `Attendee`, own QR code (`registrationId` = `{attendeeRegId}-P1`), own check-in state.

Capacity accounting rule (must be preserved by any change): every place that creates/cancels an `Attendee` or `PlusOne` must symmetrically increment/decrement `Event.currentRegistrations` inside the same transaction (see `rsvp.service.ts`, `invite.service.ts:deleteInvite`, `admin.service.ts:cancelAttendee/addPlusOne/deletePlusOne`).

### 4.2 Illuminate Life Gala domain
- **Booking** — polymorphic-ish root for `TICKET | SPONSOR | BRANDING` types via a `type` enum column rather than separate tables per type; `status` is `PENDING | CONTACTED | CONFIRMED | CANCELLED`. ID is a hand-generated sequential string `ILG0001`, `ILG0002`, … (see [§4.3](#43-booking-id-generation-important-invariant)), NOT the `cuid()` default other models use.
- **Sponsor** / **BrandingOpportunity** — 1:1 extension tables off `Booking`, populated only when `type` matches.
- **Seat** — inventory row (`seatNumber` unique, e.g. `T5-02`), optionally linked to a `Booking` and/or a `plusOneId`. There is no foreign key from `Seat.plusOneId` to `IlluminatePlusOne` in the schema — it's a bare string field, not a relation (`Needs verification` whether this is intentional or an oversight).
- **IlluminatePlusOne** — plus-ones for gala bookings; distinct model from the core `PlusOne`, no relation between the two.
- **AdminUser** / **ActivityLog** — exist in the schema (with `passwordHash`, `AdminRole` enum `ADMIN|SUPER_ADMIN`) but **`AdminUser` is not read or written anywhere in application code** — see [§7](#7-authentication-and-authorization) for why this matters.

### 4.3 Booking ID generation (important invariant)
`BookingService.generateBookingId()` (`src/modules/illuminate/services/booking.service.ts:29`) finds the highest existing `ILG####` id and increments it — it is **not** DB-sequence-backed, so concurrent booking creation has a race window (two requests can compute the same next number before either INSERT commits). A historical migration (`prisma/migrations/20260428122929_convert_booking_ids_to_sequential/`) converted previously-cuid `Booking.id` values to this sequential format in place, rewriting all dependent foreign keys (`sponsors`, `branding_opportunities`, `seats`, `illuminate_plus_ones`, `activity_logs.entityId`) via a temporary mapping table. Any future change to the ID format must follow that same pattern (add column → map → repoint FKs → swap) because `Booking.id` is referenced by string in several places, including the non-FK `ActivityLog.entityId`.

## 5. Data Layer

- **Database**: PostgreSQL (`postgresql` provider), single `DATABASE_URL`.
- **ORM**: Prisma 5, one client, injected via `PrismaService` (`src/prisma/prisma.service.ts`) which extends `PrismaClient` and hooks `onModuleInit`/`onModuleDestroy` for connect/disconnect. Every service takes `PrismaService` by constructor injection — this is the only DB access path; there is no repository abstraction layer. Note: `PrismaService` unconditionally enables `log: ['query', 'info', 'warn', 'error']` regardless of `NODE_ENV` — every SQL query is logged to stdout in production as well as dev; be aware of this when adding queries over sensitive columns (`AdminUser.passwordHash`, contact PII) and when reasoning about prod log volume/cost.
- **Migrations**: standard `prisma/migrations/*` directories, applied via `npx prisma migrate deploy` (run automatically by `entrypoint.sh` on container start, and manually in dev via `prisma migrate dev`).
- **Cascades**: `onDelete: Cascade` is used for dependent child rows (e.g. `Attendee → PlusOne`, `Booking → Sponsor/BrandingOpportunity/IlluminatePlusOne`); `Seat.bookingId` uses `onDelete: SetNull` so seats return to inventory rather than being deleted when a booking is removed.
- **Transactions**: `prisma.$transaction` is used consistently for any operation that must keep `Event.currentRegistrations` / seat availability / booking state consistent. New features that mutate more than one of these together **must** use a transaction — this is the established convention, not optional.
- **Indexing**: Illuminate models have explicit `@@index` on frequently filtered columns (`Booking.type/status/customerEmail/createdAt`, `Seat.isAvailable/bookingId`, `ActivityLog.entityType+entityId/timestamp`). Core models have no explicit indexes beyond the implicit ones from `@id`/`@unique`.
- **Caching**: none. Every read hits Postgres directly.
- **Row-level security / DB-level authorization**: none — all authorization is application-level (see §7).

## 6. API Architecture

- **Style**: REST, global prefix `/api`, plain Express request/response via NestJS controllers.
- **Route→module map**:
  | Prefix | Module | Auth |
  |---|---|---|
  | `/api/event` | EventModule | **None** |
  | `/api/invite` | InviteModule | **None** |
  | `/api/rsvp` | RsvpModule | `ThrottlerGuard` only (rate limit, not identity) |
  | `/api/qr` | QrModule | `RolesGuard` + `@Roles('admin','checkin')` on check-in/validate routes |
  | `/api/admin` | AdminModule | **None** |
  | `/api/calendar` | CalendarModule | **None** |
  | `/api/auth` | AuthModule | N/A (login endpoint itself) |
  | `/api/illuminate/bookings/ticket`, `/sponsor`, `/:id/verify` | IlluminateModule (BookingController) | None (public submission) |
  | `/api/illuminate/bookings` (list/get/patch/delete/assign-seats/…), `/admin`, `/admin/sponsor` | same | `RolesGuard` + `@Roles('admin','super_admin')` per-route |
  | `/api/illuminate/sponsors/active` | SponsorController | None (public) |
  | `/api/illuminate/sponsors` (list/update/logo/delete) | same | `RolesGuard` + `@Roles(...)` |
  | `/api/illuminate/seats*` | SeatController | `RolesGuard` + `@Roles(...)` (admin-only inventory) |
  | `/api/illuminate/plus-ones*`, `/check-in/plus-one/*` | PlusOneController | `RolesGuard` + `@Roles('admin','super_admin')` on **every** route including check-in — note this is stricter than the core QR check-in flow, which additionally allows the `checkin` role; Illuminate check-in staff would need `admin`/`super_admin`, not a dedicated `checkin` role |
  | `/api/illuminate/admin/*` (dashboard, activity-log, export) | DashboardController | `RolesGuard` + `@Roles('admin','super_admin')` at **class level** |

- **Validation**: Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts`. This only has an effect on request bodies typed as `class-validator`-decorated DTO **classes**. Several core modules (`event`, `invite`, `admin`) type their bodies as plain TypeScript `interface`s (e.g. `CreateInviteDto` in `invite.service.ts`), which the validation pipe cannot validate — those routes rely on ad hoc manual checks in the controller (e.g. `if (!createInviteDto.email...) throw new BadRequestException(...)`). New endpoints should follow the Illuminate/RSVP pattern (class-validator DTO class) not the older interface pattern.
- **Error handling**: standard Nest `HttpException` subclasses (`NotFoundException`, `BadRequestException`, `ConflictException`, `UnauthorizedException`) thrown from services, no custom global exception filter — Nest's default JSON error shape is what clients receive.
- **Response conventions**: no consistent envelope. Some endpoints return the raw Prisma entity, some return `{ success: true, ... }`, some return `{ message: string }`. Follow whichever convention the sibling endpoints in the same controller use.
- **Rate limiting**: `@nestjs/throttler`, configured via `THROTTLE_TTL`/`THROTTLE_LIMIT` env vars, applied explicitly with `@UseGuards(ThrottlerGuard)` only on `RsvpController` — not applied globally.
- **CORS**: origin allow-list built from `FRONTEND_URL`, `ADMIN_URL`, `ILLUMINATE_FRONTEND_URL` (`main.ts`); requests with no `Origin` header are allowed through (enables curl/mobile/server-to-server, but also removes CORS as any kind of protection for browser-based abuse).
- **Static files**: `public/email-images/*` served at `/static/email-images/*`, referenced by absolute URL from HTML emails (`EMAIL_HERO_IMAGE_URL` etc. env vars point back at this same server in production).

## 7. Authentication and Authorization — ⚠️ Security-Sensitive

**This is the most important section for anyone touching this codebase.**

- **Auth mechanism**: `AuthService` (`src/modules/auth/auth.service.ts`) holds a **hardcoded, in-memory array of two users**, sourced from environment variables:
  - `admin` role: `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - `checkin` role: `CHECKIN_EMAIL` / `CHECKIN_PASSWORD`
  - Password comparison is **plaintext `===`**, not hashed.
  - On success, a JWT is signed with `jsonwebtoken` directly (`jwt.sign(...)`, secret = `JWT_SECRET`, 7-day expiry). There is no `@nestjs/jwt`/`@nestjs/passport` integration.
- **`RolesGuard`** (`src/modules/auth/roles.guard.ts`): reads `@Roles(...)` metadata off the handler; if present, requires `Authorization: Bearer <token>`, verifies it via `AuthService.validateToken`, re-looks-up the user via `AuthService.verifyUser(decoded.sub)` (against the same hardcoded array), attaches `request.user`, and checks `requiredRoles.includes(user.role)`.
- **The `AdminUser` Prisma model (with `passwordHash`, `AdminRole.SUPER_ADMIN`) is never queried by `AuthService`.** It exists in the schema and is referenced by `ActivityLog.userId` and by Illuminate's `@Roles('admin', 'super_admin')` decorators, but **no login path can ever produce a `'super_admin'` role** — the hardcoded users only have `'admin'` or `'checkin'`. Any endpoint gated to `'super_admin'` only is currently unreachable by any real login — concretely, `SeatController`'s `DELETE /api/illuminate/seats/:id` is gated to `@Roles('super_admin')` alone (`seat.controller.ts:99`), so **no one can currently call this endpoint** as written. Needs verification with the team whether real DB-backed admin auth was planned but never finished, or whether `AdminUser` is entirely vestigial.
- **Critical gap — several "admin" route groups have NO guard at all**: `EventController` (`/api/event/*`), `InviteController` (`/api/invite/*`), and `AdminController` (`/api/admin/*`, including attendee CSV export with PII, dashboard stats, attendee cancellation, and invite-token generation) have **zero `@UseGuards`/`@Roles` decorators**. Despite the README documenting these as "Admin Endpoints (Requires JWT)", the code does not enforce that. Anyone who can reach the API can call these endpoints unauthenticated. This is inconsistent with `QrModule` (guarded) and the entire `IlluminateModule` (consistently guarded per-route or at class level). **Treat this as a live security issue in the current codebase, not a documentation error** — confirm with the user/team before assuming it's intentional (e.g. "protected by a reverse proxy/VPN in front"), and do not silently "fix" it as part of unrelated work without flagging it explicitly.
- **Roles in use**: `'admin'`, `'checkin'` (core), plus `'super_admin'` referenced only by Illuminate decorators (currently unreachable, see above).
- **No refresh tokens, no logout/blacklist, no password reset flow.**

## 8. External Integrations

| Integration | Where implemented | Notes |
|---|---|---|
| **Resend** (email) | `src/modules/email/email.service.ts` (core), `src/modules/illuminate/services/illuminate-email.service.ts` (Illuminate) | Two independent Resend wrappers with different template strategies — core builds HTML as inline template-literal strings; Illuminate loads `.html` files from `email-templates/` and does `{{var}}` / `{{#if}}` substitution. `RESEND_API_KEY` shared; `FROM_EMAIL` (core) vs `FROM_EMAIL`/`EMAIL_FROM` fallback (Illuminate) — inconsistent env var naming, see §14. |
| **Google Sheets** | `src/modules/sheets/sheets.service.ts` | Optional; two auth modes — Apps Script webhook (`GOOGLE_SHEETS_WEBHOOK_URL`, no credentials needed) preferred over service-account (`GOOGLE_SERVICE_ACCOUNT_KEY`/`_PATH` + `GOOGLE_SHEET_ID`). Used only by the core RSVP flow (`rsvp.service.ts`, `qr.service.ts` check-in, `admin.service.ts`) — **Illuminate bookings are never synced to Sheets.** Failures are always swallowed (logged, never thrown) so Sheets outages never block registration/check-in.
| **QR codes** | `qrcode` npm package, wrapped in `qr.service.ts` (core) — Illuminate reuses the same package directly inside `illuminate-email.service.ts` rather than depending on `QrModule`'s service for image generation (though `illuminate.module.ts` does import `QrModule`). |
| **Calendar (.ics)** | `ics` npm package — `calendar.service.ts` (core only). Illuminate generates its own `.ics` inline in `illuminate-email.service.ts` using a **hardcoded** event date/venue constant (`ILLUMINATE_EVENT`), not a DB record — see §14. |

## 9. Scheduler / Background Work

`SchedulerService` (`src/modules/scheduler/scheduler.service.ts`) is a hand-rolled interval loop, not `@nestjs/schedule`:
- Gated by `ENABLE_AUTO_REMINDERS=true`; if unset/false, nothing runs.
- On `onModuleInit`, waits 2s then starts a `setInterval` at `REMINDER_CHECK_INTERVAL_HOURS` (default 24h) that calls `InviteService.processReminders(REMINDER_INTERVAL_DAYS)` (default 7 days).
- Has a static-instance guard (`SchedulerService.instance`) intended to prevent duplicate schedulers, and an `isProcessing` flag to prevent overlapping runs.
- Only touches the core Invite/Event reminder flow — **Illuminate has no scheduled jobs.**
- There is also a manual trigger path: `POST /api/invite/process-reminders` (unauthenticated — see §7) calls the same logic on demand.

## 10. Root-Level Maintenance Scripts

`clear-seats.js`, `fix-sponsor-amounts.js`, `fix-sponsor-visibility.js`, `verify-migrations.js` (repo root) are **one-off Node scripts run manually with `node <script>.js` against a live database** — they are not wired into any npm script, CI job, or scheduled task. They exist to correct specific historical data issues in the Illuminate booking/sponsor data (e.g. recomputing `Sponsor`/`Booking` amounts, fixing `isActive`/`status` mismatches, clearing seat assignments) and to sanity-check that every Prisma model has a corresponding migration. Treat these as **evidence of past manual data-repair incidents**, not part of the deployed application; do not assume they still reflect current data shape without re-reading them against the current schema before running.

## 11. Coding Conventions

- **Module layout**: `*.module.ts` / `*.controller.ts` / `*.service.ts` per feature, colocated `*.spec.ts`; Illuminate additionally splits `controllers/`, `services/`, `dto/` into subfolders — prefer that subfolder split for any new large module, prefer the flat style for small ones (matches existing pattern split).
- **DTO validation**: **Two competing patterns coexist.** `rsvp/dto/*.ts` and `illuminate/dto/*.ts` use `class-validator` decorated classes (the correct pattern, works with the global `ValidationPipe`). `event.service.ts`, `invite.service.ts`, `admin.controller.ts` use plain TypeScript `interface`s with manual `if (!x) throw new BadRequestException` checks. **New endpoints should use the class-validator DTO class pattern** — it's already the majority/newer pattern and is what the global pipe expects.
- **Prisma access**: always via injected `PrismaService`, never a new `PrismaClient()` instantiated ad hoc (the root maintenance scripts in §10 do instantiate their own `PrismaClient()` — acceptable there since they run outside the Nest app, not a pattern to copy inside `src/`).
- **Non-critical side effects are always non-blocking**: email sending, Sheets sync, and activity logging are consistently wrapped in `try/catch` (or `.catch(err => console.error(...))` for fire-and-forget calls) so they never fail the primary write. Preserve this pattern for any new side effect — the primary DB write must succeed/fail independently of notification plumbing.
- **Logging**: `console.log`/`console.error` throughout most modules; `Logger` from `@nestjs/common` used in a few newer/more careful services (`AuthService`, `SchedulerService`, `SheetsService`, `EmailService`). Prefer `Logger` for new code.
- **IDs**: `cuid()` is the default across most models; `Booking.id` is a deliberate exception (sequential `ILG####`, hand-generated — see §4.3). Don't default new gala-adjacent models to sequential IDs without a specific reason; `cuid()` remains the baseline convention.
- **Transactions**: any multi-row state change that must stay consistent (capacity counters, seat availability + booking state) goes inside `prisma.$transaction`. This is enforced by convention, not typing — a new feature that skips this for a similar case is a bug, not a style nit.

## 12. Infrastructure and Deployment

- **Containerization**: multi-stage `Dockerfile` (Node 20 slim) — builder stage runs `npm i && prisma generate && nest build`; runtime stage copies `dist/`, `package*.json`, `prisma/`, installs prod deps, regenerates the Prisma client, and runs `entrypoint.sh`.
- **`entrypoint.sh`**: `prisma migrate deploy` → (commented-out seed) → `node dist/src/main`. Migrations run automatically on every container start.
- **`docker-compose.yml`**: local dev only — app + Postgres 15, app on host port 4002 → container 3002 (env-driven), Postgres on 5432 with hardcoded dev credentials (`username`/`password`/`event_rsvp`) — not for production use.
- **CI (`.github/workflows/deploy.yml`)**: triggers on push to `staging` only; builds and pushes a Docker image to Docker Hub (`${DOCKER_USERNAME}/event-rsvp-api:staging`). The actual VPS deploy step (SSH + `docker compose up`) is **present but fully commented out** — CI currently only produces an image; whatever deploys it to a running server is a manual or external process not visible in this repo. No workflow exists for `master`/production. Needs verification with the team on the current production deploy process.
- **Domains observed in `.env.example`**: `levyeromomedia.com` (RSVP), `admin.levyeromomedia.com`, `api.levyeromomedia.com` (this API + static email images) — real production values, treat as reference only.
- **Secrets**: all via environment variables / `.env` (not committed; `.env.example` documents required keys). No secrets manager integration.

## 13. Testing

- **Framework**: Jest + `ts-jest` for unit/service/controller specs (colocated `*.spec.ts`, run via root `test` config in `package.json`); a separate `test/jest-e2e.json` config for one Supertest e2e spec (`test/app.e2e-spec.ts`) that only checks the root `/` route returns "Hello World!" — **not a real e2e suite for any business flow**.
- **Coverage that exists**: `app`, `admin` (controller+service), `calendar` (controller+service), `email` (service), `event` (controller), `invite` (controller+service), `qr` (controller+service), `rsvp` (controller+service).
- **Coverage gaps (confirmed absent)**:
  - **The entire `illuminate` module has zero tests** — no controller/service specs for booking, sponsor, seat, plus-one, dashboard, or activity-log logic, including the seat auto-assignment algorithm in `booking.service.ts` (the most complex piece of business logic in the repo).
  - `auth` module (login, `RolesGuard`) — untested.
  - `scheduler` module — untested.
  - `sheets` module — untested.
  - No integration/e2e coverage of the actual RSVP submission flow, check-in flow, or booking flow end-to-end through HTTP.
- Run: `npm test` (unit), `npm run test:e2e`, `npm run test:cov`.

## 14. Known Technical Debt and Incomplete Work

Confirmed from code/schema/migration inspection (not speculation):

1. **Unauthenticated admin surface** — see [§7](#7-authentication-and-authorization--️-security-sensitive). `EventController`, `InviteController`, `AdminController` have no guards despite being documented as JWT-protected.
2. **`AdminUser` DB model is unused** — auth is entirely hardcoded env-var credentials; the `passwordHash`/`AdminRole.SUPER_ADMIN` schema design was never wired up. `super_admin` role is currently unreachable via any real login.
3. **`prisma/schema-illuminate.prisma` is a stale, superseded reference file** — it is not loaded by Prisma (only `prisma/schema.prisma` is, per `prisma`'s default schema path convention and the absence of any `--schema` override in scripts). It differs from the live schema (still has `sectionName` on `Seat`/`Booking` which was removed from the live schema per migration `20260420000000_remove_section_name`; missing `seatAssignments` Json field and `IlluminatePlusOne` model that exist live). Do not edit this file expecting it to take effect — update `prisma/schema.prisma` directly, and consider deleting or clearly marking this file as historical.
4. **Illuminate event details are hardcoded in code, not the database** — `ILLUMINATE_EVENT` constant in `illuminate-email.service.ts` (name, date, venue, dress code) is compiled into the app. Migration `20260416120000_add_illuminate_event_settings` exists but is an **empty placeholder** (`-- Empty migration (placeholder)`) — the intended "event settings" table/model was never implemented. Commit `6a45fc4` ("fix: update Illuminate Life Gala event date to October 15, 2026") had to change source code and redeploy just to update an event date, confirming this is a real operational pain point, not a hypothetical one.
5. **Illuminate module's own `README.md` is partly aspirational** — documents a `branding.controller.ts` that does not exist in `controllers/` (branding inquiries have no HTTP surface currently), and documents `bcrypt` hashing for admin users that isn't a dependency of this project (no `bcrypt`/`bcryptjs` in `package.json`).
6. **Booking ID generation has a race condition** — `generateBookingId()` computes "max + 1" without a DB sequence or advisory lock; concurrent ticket purchases could theoretically collide (would surface as a Prisma unique-constraint error on insert, not silently corrupt data, but is unhandled — no retry logic).
7. **`registrationId` generation for core Attendees** (`REG-${Date.now().toString().slice(-8)}`) is timestamp-derived, not guaranteed unique under concurrent submissions within the same millisecond range at scale; relies on the `@unique` DB constraint to fail loudly rather than any application-level uniqueness guarantee or retry.
8. **Inconsistent env var naming for email sender** — core uses `FROM_EMAIL` (required, throws at boot if missing); Illuminate accepts `FROM_EMAIL` **or** `EMAIL_FROM` as a fallback, with a further hardcoded literal fallback (`noreply@levyeromomedia.com`). Consolidate before adding a third email-sending path.
9. **`Seat.plusOneId`** is a bare string field, not a Prisma relation to `IlluminatePlusOne` — no referential integrity enforced at the DB level for that link. Needs verification whether this was intentional (avoiding a second FK direction) or an oversight.
10. **CI only builds/pushes an image on `staging`**; the VPS deployment step is commented out and no workflow targets a `master`/production branch. The real production deploy mechanism is not visible in this repo — needs verification with the team.
11. **Zero test coverage for the Illuminate module** (see §13) — the seat-assignment algorithm, sponsor-tier limit logic, and booking-ID sequencing are all unverified by automated tests.
12. **Two independent, slightly divergent email-sending implementations** (core `EmailService` vs Illuminate `IlluminateEmailService`) with no shared base — a bug fixed in one (e.g. around Resend error handling) will not automatically apply to the other.

## 15. Existing Documentation (`docs/`)

Supplementary usage guides exist per feature; consult them for operational detail, but verify against the current source before trusting specifics (some predate later changes, e.g. `FRONTEND_INTEGRATION.md` references a local dev DB name that may not match `.env.example`):

- `CALENDAR_USAGE.md` — Calendar module endpoints and response shape.
- `EMAIL_USAGE.md` — core Email module configuration (Resend setup).
- `FRONTEND_INTEGRATION.md` — how the (external) Next.js frontend is expected to call this API.
- `GOOGLE_SHEETS_INTEGRATION.md` — both Sheets auth methods (webhook vs service account).
- `INVITE_MANAGEMENT.md` — invite lifecycle (create, bulk-create, resend, expiry).
- `REMINDER_EMAILS.md` — the automated reminder system covered in §9.
- `RESEND_EMAIL_SETUP.md` — Resend account/domain setup steps.
- `SEATING_RULES.md` — the Illuminate seat auto-assignment rules; matches the algorithm in `booking.service.ts` (`provisionSeats`/`provisionFullTable`) as of this writing — VIP Individual → tables T1–T4 only; "Circle of Illumination"/"Table of 10" → full 10-seat table, lowest table number ≥5 first; other individual tickets → fill partially-occupied non-VIP tables first, then new tables.

## Guidance for Coding Agents

**Where new features normally belong**:
- New core RSVP-facing behavior (events, invites, attendees, check-in) → the relevant existing module under `src/modules/{event,invite,rsvp,qr,admin,calendar,email}`. Reuse `PrismaService`, wrap multi-row state changes in `$transaction`, keep side effects (email/Sheets) non-blocking.
- New Illuminate Life Gala behavior (bookings, sponsors, seats, gala plus-ones) → `src/modules/illuminate/`, following its existing `controllers/`/`services/`/`dto/` split and its `class-validator` DTO convention.
- Do not invent a third product domain inside either of these — if a genuinely new event/product is being added, prefer mirroring the Illuminate module's structure as a new sibling module rather than overloading the core Event model (which is single-tenant per row, not designed for gala-style ticket tiers/sponsorship).

**Existing abstractions to reuse, not duplicate**:
- `PrismaService` for all DB access (never instantiate `new PrismaClient()` inside `src/`).
- `RolesGuard` + `@Roles(...)` from `src/modules/auth/` for any new protected route — do not write a new guard.
- `QrService.generateQrCodeImage()` for any new QR-code-bearing entity, rather than importing `qrcode` directly a third time.
- The `class-validator` DTO pattern (see `rsvp/dto/`, `illuminate/dto/`) for any new request body — not the older plain-interface pattern.

**Architectural boundaries not to cross**:
- Do not add cross-links between the core domain (`Attendee`/`PlusOne`/`Invite`/`Event`) and the Illuminate domain (`Booking`/`IlluminatePlusOne`/`Sponsor`/`Seat`) at the schema level — they are intentionally separate product domains sharing infrastructure, not a unified data model. If a genuine business need arises to link them, treat that as a deliberate architectural decision requiring explicit discussion, not an incidental FK add.
- Do not assume `AdminUser`/`ActivityLog.userId` reflects real logged-in identity beyond the string `sub` claim in the hardcoded JWT (`'admin-1'` or `'checkin-1'`) — there is no real per-person user identity in this system today.

**Generated / do-not-hand-edit**:
- `prisma/migrations/*` — never hand-edit an already-applied migration; add a new one.
- `prisma/schema-illuminate.prisma` — stale/unused; do not edit it expecting effect (see §14 item 3). Prefer flagging it for deletion if asked to clean up docs.
- `@prisma/client` generated types — never edit generated output; change `schema.prisma` and regenerate.

**Sensitive files / areas**:
- `src/modules/auth/*` — any change here has repo-wide security implications; see §7 before touching.
- `src/modules/admin/admin.controller.ts`, `src/modules/event/event.controller.ts`, `src/modules/invite/invite.controller.ts` — currently unauthenticated; if asked to "add a new admin endpoint" here, flag the missing guard on the *existing* endpoints back to the user rather than silently perpetuating the gap on the new one.
- `.env` / `.env.example` values that look like real production domains/credentials — treat `.env.example` values as illustrative reference, never as safe defaults to ship.

**Shared contracts requiring coordinated changes**:
- `Booking.id` format (`ILG####`) is depended on by `ActivityLog.entityId` (a bare string, not an FK) and by every child table's `bookingId` FK — changing the ID scheme again requires the same migrate-and-repoint pattern used in `20260428122929_convert_booking_ids_to_sequential`.
- The three CORS origins in `main.ts` (`FRONTEND_URL`, `ADMIN_URL`, `ILLUMINATE_FRONTEND_URL`) must stay in sync with whatever frontends actually call this API — adding a fourth frontend requires updating this allow-list.
- Email image URLs (`EMAIL_HERO_IMAGE_URL` etc.) are consumed by both `email.service.ts` and `invite.service.ts`'s inline templates — changing asset paths/filenames means updating `public/email-images/` and every env var reference together.

**Testing expectations for new work**:
- Given the confirmed gap in §13, any new Illuminate-module logic should add its own `*.spec.ts` rather than following the (nonexistent) local precedent — model new specs on the core modules' existing service/controller specs (`rsvp.service.spec.ts`, `admin.service.spec.ts`) which do have reasonable coverage patterns to copy.

**Backward compatibility**:
- `registrationId`/`qrCode` formats for `Attendee`/`PlusOne`/`IlluminatePlusOne` are printed on physical/email materials and scanned at check-in — do not change their format without a migration plan for already-issued codes.
- Frontend contracts (`docs/FRONTEND_INTEGRATION.md`) describe the expected request/response shapes for external consumers not in this repo — treat any change to existing endpoint request/response shape as a breaking change requiring coordination, even though nothing enforces this in-repo (no shared OpenAPI/contract file exists — `Needs verification` whether one is maintained externally).
