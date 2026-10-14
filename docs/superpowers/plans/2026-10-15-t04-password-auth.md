# T04 Password Authentication Implementation Plan

> Execution: native implementation in the shared workspace; TL assigns independent review.

**Goal:** Controlled person and responsible-owner Agent creation, normal password login and real permission checks.

**Architecture:** Add password credentials and account kinds to existing SQL accounts; sessions record authentication method so password-only accounts do not require Feishu configuration. Reuse audited authorization/version invalidation. CLI writes generated secrets exclusively to an explicitly named private file.

**Tech Stack:** Existing TypeScript/Fastify/Next.js/pg; Node asynchronous scrypt and exclusive file descriptors.

**Spec:** Gitea #5/#1, authentication-and-sessions.md, ADR0005–0008/0024/0028.

## Constraints and decisions

- No public registration, employee credential reuse, token exchange shortcuts or production fixtures.
- New accounts active with zero roles. Agent owner must be a live person account; disabled owners block Agent access.
- DEPLOYMENT_ENV defaults PROD; DEV/UAT allow Agent by default; explicit AGENT_LOGIN_ENABLED true/false overrides. Role grants remain independent. Check policy again on every session request.
- Passwords generated with 256-bit randomness; salted asynchronous scrypt N32768/r8/p3, maxmem64MiB, 64-byte key. Store versioned hash only; bounded credentials and generic invalid-login responses.
- CLI create-person/create-agent/reset-agent requires explicit target fields and confirmation; output file exclusive0600 in dedicated mounted credentials directory, host ownership, no silent overwrite. Failed transaction removes prepared file; uncertain COMMIT preserves file for operator reconciliation.
- Person linking, reset and persistent failure limits belong to T08/T07. Future verified linking shares account/version; never infer identity from matching names/emails/usernames. Document this boundary.
- Existing Feishu sessions retain identity-realm checks. Password sessions require a current enabled password credential. Agent policy, owner, independent max/idle limits apply to both login and access.

## Review focus

- Existing-file/symlink/umask failures must not create unreachable accounts or leak passwords.
- CLI SQL/audit failure must roll back account/credential and clean up unpublished secrets.
- Missing/disabled owner and PROD policy must reject already-issued Agent sessions.
- Audit-only login failure allows committed session; overall DB failure does not.
- Last effective administrator includes password people and enabled Agents; disabled owner cannot strand the only administrator.

## Tasks

### 1: SQL and credential boundary

Files: database/migrations/0004_password_accounts.sql; apps/api/src/{password,password-accounts,auth-config,auth-store,authorization}.ts; tests/password.test.mjs.

- [x] Observe failing real HTTP password endpoint test.
- [x] Add constrained person/Agent ownership, unique credentials and session method via immutable migration.
- [x] Implement hashing, controlled account creation/file delivery, Agent reset and reliable management audit.
- [x] Validate real SQL rollback, ownership, environment policy, last-admin and session persistence.

### 2: HTTP/CLI/browser

Files: apps/api/src/{auth-routes,password-cli,manage}.ts; apps/web/app/{login/page,components/password-login,account/page}.tsx; compose.yaml/config/auth-copy.json/.env.example.

- [x] Implement normal same-origin password POST, bounded runtime inputs and safe cookie session.
- [x] Add menu and complete-argument commands; verify confirmation and no plaintext output.
- [x] Exercise real browser no-role/user/explicit admin and PROD disabled/enabled policy.

### 3: Delivery

Files: docs/specs/password-authentication.md; docs/discovery/t04-acceptance.md; README.md.

- [x] Build/start/migrate containers; run full relevant test command and typecheck.
- [x] Record commands/results/platform limits; clean test-only resources.
- [x] Commit locally and report SHA/clean state to TL; no push/issue closure.

Execution: All independent T04 implementation/container/browser verification complete; real Feishu #4 remains separately pending user consent. Final tests50/50 and API/Web typecheck pass. PostgreSQL CASE integer inference fixed after actual42883 failure. Password form explicitly POSTs and is disabled until client readiness to prevent pre-hydration native URL submission.
