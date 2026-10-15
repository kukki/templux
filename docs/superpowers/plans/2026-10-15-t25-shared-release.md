# T25 Shared Release Implementation Plan

> **For agentic workers:** Execute inline; TL arranges independent review after delivery.

**Goal:** Two versioned npm artifacts consumed by a separately owned runnable project with exact combination verification.

**Architecture:** Keep existing core relative layout inside @templux/core; ship existing server/client UI under explicit @templux/web exports and Next transpilation. Protected project routes reuse live sessions, transactions and maintenance barriers. Projects own routes/configuration/version and pin artifacts plus baseline.

**Tech Stack:** Node24, npm pack/lock, TypeScript, Fastify5, Next16/React19, PG18.6 tools.

**Spec:** Gitea #26/#1 stories5/7/8/15; ADR0011/0012/0029 and project-creation-and-upgrades.md.

## Global Constraints

- No registry/cloud publication, push, automatic deployment, generator or upgrade merge system.
- No original0004/.env/presentation/real account changes; self-owned t25 only.
- Exact shared0.1.0; independent business version. Reject missing lock, wrong hash/version/combination before install/build.
- No auth override in public exports; core SQL remains immutable.

## Review Focus

- SSR/client exports and assets/config/migrations work inside node_modules.
- Same-version changed bytes fail; manifest trust is separately pinned.
- Business extensions cannot use supported interfaces to register core paths or skip live session checks.
- Baseline and artifact build never absorb secrets or consumer customizations.
- Frontend/backend and private tools work without a template checkout at runtime.

## Tasks

- [x] Test and implement narrow protected project interface (including real COMMIT waiting and lock-after-change validation).
- [x] Test validation; implement explicit export staging, npm pack, exact checked manifest.
- [x] Supply owned skeleton, lock/baseline and independent Docker targets.
- [x] Real artifact-only SQL/HTTP/browser/tools consumption and invalid combination controls.
- [x] Relevant regression/typecheck, artifact/source evidence and cleanup (16专项、105核心、7实际闭环及CDP截图).
- [x] Local implementation commit66aa7c2 plus acceptance delivery for TL independent review.

## Rulings

- User delegated design/execution; concrete design sent to TL, continue without approval pause.
- Exports describe supported imports, not a malicious-code sandbox. Host/project server code remains trusted.
- Preserve internal relative layout rather than refactor existing imports; separate skeleton and tarballs establish consumption.
