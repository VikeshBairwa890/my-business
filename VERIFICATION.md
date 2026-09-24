# Verification — 2026-09-13

This is a working first release, not a signed APK or a deployed production service.

## Passed checks

- TypeScript check (`npm run typecheck`).
- 13 automated domain/API tests (`npm test`).
- Expo web production export.
- Expo Android and iOS JavaScript/Hermes bundle exports. These are **not native device tests or APK/IPA builds**.
- Browser smoke test of the actual Expo web build against the actual API with isolated embedded PostgreSQL:
  - Login and session restoration.
  - Site list and site details.
  - Worker creation via the UI.
  - Attendance creation via the UI.
  - Client receipt creation via the UI.
  - Record still visible after page reload.
  - All six navigation tabs.
  - Mobile-width horizontal-overflow check and desktop layout capture.
  - No JavaScript page errors during this flow.

The test database uses PGlite, an embedded PostgreSQL engine. A separate PostgreSQL server, Neon connection, physical phones, PDF native sharing, and production infrastructure were not verified here.

## Screenshots

`qa/` contains screenshots of the real rendered Expo web application at mobile and desktop widths. All names and financial amounts shown are fictional seeded QA records, not a real contractor's accounts. These are not native Android/iOS screenshots.

## Remaining release gates

See the explicit pending-scope list in README.md. Before entering real payroll or customer financial data: deploy with HTTPS and restricted database credentials; configure backups and recovery; test on physical devices; review authorization, reconciliation and financial edge cases with the contractor.
