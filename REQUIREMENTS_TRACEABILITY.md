# Group28 Requirement Traceability Matrix

This prototype implements the Assignment Outline prototype presentation scope with React + Vite + TypeScript, Node.js + Express, SQLite + Prisma, Zod validation, and Vitest/Supertest tests.

The implementation keeps all 63 Group28 requirements visible and traceable through:

- UI evidence in the dashboard
- API endpoint behavior
- Prisma database model/table
- Test case or review reference

| ID | Module | UI Evidence | API Evidence | DB Evidence | Test / Review Evidence |
| --- | --- | --- | --- | --- | --- |
| EDR-01 | Vehicle Module | Driver / Vehicle Registration | POST /api/vehicles | Vehicle | UC-1 successful registration |
| EDR-02 | Vehicle Module | Same-page validation messages | POST /api/vehicles + Zod/business rules | Vehicle | EDR-02 validation tests |
| EDR-03 | Map Module | Map & Reservation panel | GET /api/stations | ChargingStation | UC-2 map display |
| EDR-04 | Map Module | Connector/power/price filters | GET /api/stations | Charger | Filter behavior review |
| EDR-05 | Map Module | Green/yellow/red markers | GET /api/stations | Charger.status | Marker status review |
| EDR-06 | Reservation Module | Reservation form | POST /api/reservations | Reservation | UC-2 reservation test |
| EDR-07 | Reservation Module | Compatibility panel | POST /api/reservations | Vehicle + Charger | EDR-07 incompatible reservation test |
| EDR-08 | Reservation Module | Reservation validation errors | POST /api/reservations | Reservation | EDR-08 rule tests |
| EDR-09 | Charging Module | Live session progress/cost screen | POST /api/sessions/start | ChargingSession | UC-3 running session review |
| EDR-10 | History Module | Charging History table | GET /api/bootstrap | ChargingSession | UC-3 history review |
| EDR-11 | Favorites Module | Favorite toggle/list | POST/DELETE /api/favorites | FavoriteStation | Favorite toggle test |
| EDR-12 | Issue Module | Issue form | POST /api/issues | IssueReport | Issue creation review |
| EDR-13 | Notification Module | Notification panel | Workflow endpoints | Notification | SDR-04 notification test |
| EDR-14 | Reservation Module | Reservation management cancel action | POST /api/reservations/:id/cancel | Reservation + Transaction | Cancellation/refund test |
| EDR-15 | Reservation Module | Estimated cost in reservation | POST /api/reservations | Reservation.estimatedCost | UC-2 estimated cost review |
| EDR-16 | Reservation Module | Reservation management no-show action | POST /api/reservations/:id/no-show | Reservation.noShowAt | No-show test |
| EDR-17 | Charging Module | Target SoC field and auto-stop | POST /api/sessions/:id/complete | ChargingSession.targetSoc | Target SoC test |
| EDR-18 | Charging Module | Sync status and recovery action | POST /api/sessions/:id/simulate-sync | ChargingSession.syncStatus | Connectivity sync test |
| SOR-01 | Operator Module | Charger status selectors | PATCH /api/operator/chargers/:id/status | Charger.status | Operator status review |
| SOR-02 | Operator Module | Station name/address/hours/status and charger price editor | PATCH /api/operator/stations/:id | ChargingStation + Charger | Station config test |
| SOR-03 | Operator Module | Current/upcoming reservation list | GET /api/bootstrap | Reservation | Operator reservation review |
| SOR-04 | Operator Module | Issue status selectors | PATCH /api/issues/:id | IssueReport | Issue status review |
| SOR-05 | Operator Module | Out-of-service flow | PATCH /api/operator/chargers/:id/status | Reservation + Notification | Auto-cancel test |
| SOR-06 | Operator Module | Utilization/occupancy report tables | GET /api/admin/reports | Reservation + ChargingSession | Utilization report test |
| ADR-01 | Admin Module | Add/remove station and default charger form | POST/DELETE /api/admin/stations | ChargingStation | Admin station test |
| ADR-02 | Admin Module | User/operator role and active-state management with inactive-user blocking | PATCH /api/admin/users/:id | User | Admin user test |
| ADR-03 | Admin Module | Revenue/utilization cards and tables | GET /api/admin/reports | Transaction + ChargingSession | Report test |
| ADR-04 | Admin Module | Peak-hour table | GET /api/admin/reports | ChargingSession.startTime | Peak-hour test |
| ADR-05 | Admin Module | Activity summary with cancellations/no-shows/issues | GET /api/admin/reports | Reservation + IssueReport + AuditLog | Activity report test |
| ADR-06 | Security Module | Role switch and guards | Protected role endpoints | User.role | RBAC API test |
| ADR-07 | Audit Module | Audit log table | GET /api/audit | AuditLog + Transaction | Audit review |
| ADR-08 | Admin Module | Availability KPI | GET /api/admin/reports | Computed report | Availability review |
| MNS-01 | Map Module | Current location badge | GET /api/bootstrap | Seeded coordinates | Map review |
| MNS-02 | Map Module | Station markers | GET /api/stations | ChargingStation | Map review |
| MNS-03 | Map Module | Marker color coding | GET /api/stations | Charger.status | Marker review |
| MNS-04 | Map Module | Distance labels | GET /api/stations | Station coordinates | Distance review |
| MNS-05 | Map Module | Route panel and maps link | GET /api/stations | Station coordinates | Route review |
| MNS-06 | Map Module | Refresh action/status data | GET /api/stations | Charger.status | Refresh review |
| MNS-07 | Map Module | Instant filters | GET /api/stations | Charger | Filter review |
| PWS-01 | Wallet Module | Top-up form | POST /api/wallet/top-up | Wallet + Transaction | Wallet top-up review |
| PWS-02 | Wallet Module | Session completion deduction | POST /api/sessions/:id/complete | Wallet + Transaction | UC-3 deduction test |
| PWS-03 | Wallet Module | Receipt panel/table | POST /api/sessions/:id/complete | Transaction.receiptNumber | Receipt test |
| PWS-04 | Wallet Module | Cancellation refund result | POST /api/reservations/:id/cancel | Transaction/Reservation | Refund test |
| PWS-05 | Wallet Module | Insufficient balance error | POST /api/reservations | Wallet.balance | Insufficient wallet review |
| PWS-06 | Wallet Module | Balance and transaction history | GET /api/bootstrap | Wallet + Transaction | Wallet history review |
| PWS-07 | Wallet Module | Estimated-cost sufficiency badge | POST /api/reservations | Wallet.balance | Estimated-cost review |
| PWS-08 | Wallet Module | Low balance session warning/stop | POST /api/sessions/:id/complete | Wallet + ChargingSession | Mid-session depletion test |
| PWS-09 | Compliance Module | TLS 1.2+ payment gateway control | Deployment control | Documented control | Security review |
| UIR-01 | UI Module | Consistent dashboard navigation | N/A | N/A | UI smoke review |
| UIR-02 | UI Module | Success/error messages | All mutating endpoints | N/A | UI message review |
| UIR-03 | UI Module | Same-page form validation | Zod-backed APIs | N/A | Validation tests |
| UIR-04 | UI Module | Material-inspired hierarchy | N/A | N/A | Visual review |
| UIR-05 | UI Module | Readable summary cards/tables | Read endpoints | N/A | Readability review |
| GRR-01 | Compliance Module | Receipt table | Wallet/session endpoints | Transaction | Receipt review |
| GRR-02 | Compliance Module | Charged/deducted/refund summaries | Wallet/reservation/session endpoints | Transaction | Transparency review |
| GRR-03 | Compliance Module | Transaction retention table | GET /api/bootstrap | Transaction | Persistence review |
| GRR-04 | Compliance Module | Retrievable financial history | GET /api/bootstrap | Transaction | History review |
| GRR-05 | Compliance Module | Compliance controls + RBAC | Validation/RBAC endpoints | User + Wallet | Compliance review |
| SDR-01 | Security Module | Pre-authenticated demo identity, account switch and sign-out screen | x-demo-user-id header | User + scoped records | Account scoping test |
| SDR-02 | Security Module | Role and active-state guarded APIs/panels | Protected APIs | User.role + User.isActive | RBAC API test |
| SDR-03 | Audit Module | Audit log | GET /api/audit | AuditLog | Audit review |
| SDR-04 | Security Module | Failed-login simulation and admin notification panel | POST /api/security/simulate-failed-login | Notification + AuditLog | Alert test |
| SDR-05 | Security Module | Unauthorized guard messages | Role checks | User.role | Unauthorized access test |
