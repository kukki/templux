# T03 Feishu Authentication Implementation Plan

> **For agentic workers:** Use executing-plans to implement these tasks in the shared workspace; TL assigns independent review after implementation.

**Goal:** Verified Feishu users enter Pending; host CLI authorization enables protected access with persistent, revocable sessions.

**Architecture:** Backend owns OAuth state/browser binding, verified tenant identities, database sessions and authorization. Next.js forwards same-origin API requests and renders login/Pending/protected pages. A project-owned role file supplies predefined permissions; CLI and future web administration share one audited transaction and last-admin guard.

**Tech Stack:** Existing TypeScript, Fastify, pg/PostgreSQL, Next.js; Node crypto/fetch; no ORM or alternate authentication route.

**Spec:** Gitea #4 and docs/specs/authentication-and-sessions.md; parent #1.

## Global Constraints

- Public/default status remains available; Pending/disabled/zero effective roles cannot access protected application data.
- App ID/Secret and allowed tenant are environment configuration; runtime OAuth tokens never become configuration or application-session credentials.
- Session defaults: maximum12h, idle10m; session changes read latest DB authorization version. Heartbeat/client idle interaction belongs to T05.
- Grant/revoke/state updates and audit commit together; all mutations serialize around last-active-admin invariant.
- Production endpoints are fixed official URLs. Test HTTP transport substitution lives exclusively in tests; fixtures never become deployed authentication routes or env-selected providers.

## Review Focus

- State mismatch/replay and missing browser binding reject before provider exchange.
- Wrong or missing tenant and malformed provider data create no local account/session.
- Concurrent first login does not create duplicate identities; concurrent admin demotion cannot remove all administrators.
- Audit failure rolls back authorization version, roles/state, and old-session validity.
- Credentials/codes/session cookies do not enter API errors, request logs, or UI bundles.

## Tasks

### 1: OAuth and storage boundaries

Files: apps/api/src/{auth-config,feishu,auth-store}.ts; database/migrations/0002_authentication.sql; config/roles.json; tests/auth.test.mjs.

Interfaces: readAuthConfig() validates public origin/redirect; Feishu client exchanges(code) to verified subject; registerSession(pool,identity) returns opaque browser session; readSession(pool,token,touch) returns account/permissions or typed failure.

- [x] Write red tests against HTTP auth routes and real isolated PostgreSQL, including provider request contract/state/Pending.
- [x] Create constrained identity/account/role/session/OAuth/audit tables and supporting FK/expiry indexes.
- [x] Implement state+browser binding, Confidential Client authentication, fixed official v3 token/current user-info endpoints, strict response validation and exact tenant matching.
- [x] Persist hashed opaque sessions and authorization-version checks; registration audit required, existing successful-login audit best effort with structured diagnostic.
- [x] Verify errors and protocol responses without printing credentials.

### 2: Shared authorization and host CLI

Files: apps/api/src/{authorization,auth-cli,auth-routes}.ts; manage.ts/server.ts; tests/auth.test.mjs.

Interfaces: setAuthorization(pool,{accountId,roles,state},actor) atomically applies state/roles/version and audit; registerAuthRoutes(server,pool,config,transport=fetch) exposes only genuine OAuth/session/protected/logout routes. Test transport is constructor injection in test-owned server processes.

- [x] Add red tests for granting Pending, role union/unknown role rejection, last admin/concurrency, old session rejection, and audit failure rollback.
- [x] Implement advisory transaction serialization, last-admin checks, explicit CLI confirm/overwrite-independent policy, users read-only and authorize menu/arguments.
- [x] Verify CLI errors, genuine session/protected HTTP, and SQL audit contents in containers.

### 3: Browser consumer and documentation

Files: apps/web/app/{api/[...path]/route.ts,login/page.tsx,account/page.tsx,protected/page.tsx}; shared/default-presentation.json/config/presentation.json; compose.yaml/.env.example; docs/specs/feishu-authentication.md; acceptance record.

- [x] Implement same-origin API forwarding with fixed internal origin, no external credential exposure, manual redirect propagation and HttpOnly cookies.
- [x] Add centralized login/Pending/error/protected copy, project branding and authorization-driven protected content.
- [x] Validate production missing-config page, isolated mock-provider genuine OAuth browser Pending→CLI grant→relogin→protected flow, and desktop/narrow layout.
- [x] Execute container tests/typecheck/start and document real Feishu credential/redirect/scope setup and unexecuted real organization acceptance.
- [x] Commit locally, preserve earlier commits, report evidence to TL; no push or issue closure.

Ruling: The complete current official authorize documentation limits its PKCE flow to token v2. Use the current v3 Confidential Client flow with mandatory App Secret and one-time browser-bound state; remove unused verifier via immutable-history migration0003. This follows the actual supported protocol rather than mixing documentation fragments. Real v3+PKCE returned20049; regression expectations now assert the supported parameter contract.

Execution note: Independent container/browser work is complete. Real user consent was handed off; final actual v3 exchange/tenant/Pending check remains pending that action. No automatic administrator grant to the real person.
