# ThekaBook — Contractor Work & Hisab

React Native + Expo mobile application, with a PostgreSQL-backed Node.js API.
Working name only; trademark/domain availability has not been checked.

## What is implemented

- Email/password registration, one private contractor workspace per account, expiring/revocable sessions.
- Six mobile screens: Overview, Sites, Labour, Attendance, Hisab, Reports.
- Sites: owner details, scope notes, labour-only/material-inclusive contracts, fixed/unit/daily pricing, dates and status.
- Labour profiles, daily and hourly overtime rates, active/inactive status.
- Site attendance: full/half/absent, overtime in minutes, historical rate snapshots, correction reasons and audit records.
- Validation prevents more than one full day across sites for a worker/date.
- Client receipts, worker payments and advances, approved extra-work records.
- Material and other expense bills with separate supplier payments and outstanding balances.
- Payments are protected against repeat submissions by server-side idempotency keys.
- Financial entries are voided with a reason, not deleted; bills with active payments cannot be voided first.
- Site cost, estimated/final margin, cash movement, owner balances and worker balances.
- Native PDF generation/sharing and text share; web print-to-PDF and clipboard export.
- Tenant-scoped database queries, composite foreign keys, input validation, password hashing, session-token hashing, rate limits and security headers.

## Important accounting rules

All money is stored as integer **paise**, not floating-point rupees. Rate changes never alter existing attendance costs.

1. Attendance creates **earned wages**, not a payment.
2. Labour payment/advance changes cash and worker balance, not earned labour cost.
3. MATERIAL and EXPENSE entries record **cost incurred**, not cash paid. Add a linked SUPPLIER_PAYMENT, even for a bill paid immediately.
4. Client receipts change cash, not the contract amount. Extra work changes the contract only when you record its approval reference.
5. Estimated site margin = agreed contract + approved extras − incurred costs − estimated remaining costs.
6. Completed-site margin omits remaining estimated cost. It is only as complete as the costs entered.
7. Net cash movement = client receipts − labour payments − supplier/expense payments. This is not a bank balance or profit.
8. Unpaid contract value is not necessarily currently due. This release does not schedule client payment milestones.
9. A negative worker balance means an advance. A negative owner balance means overcollection and must be reconciled.
10. Cost bills assume material is attributable/consumed on that site. Do not enter unused/reusable stock as final consumed cost. Stock transfers, material returns and owner-supplied material inventory are not automated yet.
11. Unit/daily contracts use an explicitly agreed quantity, not the sum of worker attendance days. Future measurement-book and approved-quantity workflows are separate scope.

These reports are **site margins before shared overhead and tax**, not audited business net profit, GST invoices or legal proof of acceptance.

## Start with PostgreSQL

Requirements: Node.js 22.13+ (tested using Node 24), npm, Docker or an existing PostgreSQL database, and Expo Go compatible with SDK 57 or a development build.

From the repository root:

```sh
npm ci
docker compose up -d
```

Copy `apps/api/.env.example` to `apps/api/.env`. Its default connection matches the local Docker database. For Neon/another host replace `DATABASE_URL` with your own URL and required TLS parameters. Do not disable certificate verification.

```sh
npm run migrate -w apps/api
npm run api
```

In another terminal:

```sh
npm run web
```

Open the address printed by Expo (normally localhost:8081). Choose **Create an account**, then create a site and worker. There is no automatic demo login or seeded balance.

### On your Android/iPhone

Copy `apps/mobile/.env.example` to `apps/mobile/.env`. Set `EXPO_PUBLIC_API_URL` to your API host. For local Wi-Fi testing this is your computer's LAN IP, for example `http://192.168.1.10:4000`, NOT `localhost`.

```sh
npm run mobile
```

Scan the Expo QR code using a compatible Expo Go. If the store's Expo Go does not support SDK 57, use a compatible development build. Allow the API port through your local firewall only on your private network. Production must use HTTPS.

Never put `DATABASE_URL`, database credentials, or private keys into any `EXPO_PUBLIC_*` variable. Mobile users communicate with the API; only the API connects to PostgreSQL.

### Optional local preview without Docker

The API also has a **development-only PGlite adapter** (embedded PostgreSQL/WASM, not SQLite). Set the following in `apps/api/.env` instead of using the Docker URL:

```env
DATABASE_DRIVER=pglite
PGLITE_PATH=./.data/local
PORT=4000
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

Run the same migration and API commands. This stores preview data locally. Do not run two API processes against the same embedded directory. Production rejects this driver. The hosted PostgreSQL driver uses `pg`.

## Recommended first test flow

1. Register your contractor account.
2. Create a labour + material site with contract ₹50,000 and remaining expected cost ₹10,000.
3. Add a worker at ₹700/day, overtime ₹100/hour.
4. Mark 1 day + 60 minutes overtime: earned wages must be ₹800.
5. Pay that worker ₹500: worker balance must be ₹300; labour cost must remain ₹800.
6. Record a ₹5,000 material bill: costs rise, cash does not change yet.
7. Pay ₹2,000 against that bill: supplier outstanding must be ₹3,000.
8. Record ₹20,000 received from the owner: owner balance must be ₹30,000.
9. Cash movement must be ₹17,500. Estimated site margin must be ₹34,200.
10. Change the worker's daily rate: the original attendance must remain ₹800.
11. Export/share the statement and inspect the numbers.

## Tests and builds

```sh
npm test
npm run typecheck
npm run export:web -w apps/mobile
```

Integration tests run the API against isolated in-memory embedded PostgreSQL. They cover money rounding, authentication, tenant isolation, invalid calendar dates, attendance overlap, historical rates, idempotency, supplier overpayment, void rules, advance accounting and logout.

Optional browser smoke test: run `npx playwright install chromium`, build web, then run `node scripts/ui-smoke.mjs`. Playwright is included as a dev dependency. On compatible Linux hosts without a separately installed browser, `USE_PACKAGED_CHROMIUM=1 node scripts/ui-smoke.mjs` uses the bundled test executable. The test runs its own isolated API and uses fictional records. Stop other servers on ports 4000/8081 first.

Optional sample data: with the local API running, set `DEMO_PASSWORD` to a test password of at least 10 characters and run `node apps/api/src/seed.mjs`. It creates `demo@thekabook.test` with clearly fictional projects. This is disabled in production and will fail rather than overwrite an existing email.

## Deployment / APK

The repository includes `eas.json` with an internal Android APK profile. To generate an APK, an Expo account, project configuration, accessible HTTPS API, and build credentials are still required. Use `eas build --platform android --profile preview` after configuring the production API variable in the mobile build environment. A JavaScript bundle is not an APK.

Host the API on a Node-capable server, set `NODE_ENV=production`, `DATABASE_URL`, `PORT` and exact browser `CORS_ORIGINS`, run the migration, then start it. Put it behind HTTPS. Native clients do not rely on browser CORS for security; session authorization is required on every data endpoint.

Use a restricted database application role in production. Do not expose PostgreSQL publicly. Configure database backups, retention and test restores before real financial use. `schema.sql` is an idempotent initial migration only; future schema changes need new versioned migrations, not edits pretending to upgrade existing tables.

## Scope still pending — do not call this production-complete

For the detailed phase-wise execution plan and backlog, see [ROADMAP.md](file:///c:/NewFolder/MyBusiness/ROADMAP.md).

- Physical Android/iOS device verification, APK signing and store release.
- Live hosted PostgreSQL connection and production deployment; no hosted database credentials were supplied.
- Offline queues, conflict resolution and background sync. Current writes require connectivity; failed saves show errors.
- Supervisor/team-member logins, role management and invitation flows; current release has one owner login per workspace.
- Password reset, email verification and account recovery.
- Bulk attendance, attendance rate override corrections, wage refunds/deductions and finalized payroll periods.
- Attachment upload/storage, signed client approvals, payment schedules and measurement books.
- Material inventory, transfers, returns and owner-supplied stock.
- Shared overhead allocation, taxes, refunds, bank reconciliation and audited accounting.
- Server pagination for large accounts; snapshot requests fail explicitly beyond 10,000 rows in any core table, rather than silently undercounting finances.
- Data-retention workflows, production monitoring and a full security/accessibility audit.

## Project layout

```text
apps/mobile/       Expo React Native application
apps/api/src/      API, PostgreSQL driver, schema, demo seed
apps/api/test/     Automated integration tests
shared/            Integer-paise calculations and report formatting
scripts/           Optional UI smoke test
```
#   m y - b u s i n e s s  
 