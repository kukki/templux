# T15 implementation plan

Goal: opt-in row editing and an accessible edit dialog, with explicit save/timeout/verification and T14 validation/navigation contracts.
Spec: Gitea #16/#1 stories81–82; web-elements; forms-and-unsaved-edits; ADR0012/0020.
Execution: native Team implementation, independent review after handoff; no additional design approval required by assigned scope.

## Architecture and choices

- Extend createEditor compatibly: optional deadline, save attempt ID, public unconfirmed receipt, explicit reconciliation; submit returns only accepted result. No automatic retry. Timeout releases waiting, abort is advisory, late completion ignored. Existing ordinary form behavior stays unless options explicitly enable deadline/lock.
- Add scoped requestDiscard for a single registered editor; optional blocked snapshot prevents app navigation while an edit save is pending. Session ending remains unconditional.
- EditSession owns one string-field editor and shared controls/error focus/result verification. Native EditDialog supplies modal focus/inert behavior, no backdrop close, Escape goes through guarded close, waiting blocks event and UI close.
- EditableTable defaults to existing ReadonlyTable; editing config explicit, one active row per table, stable identity/version required. Freeze active record and configuration, keep draft across refresh, flag conflicts and refuse stale writes/commits. Changed target dialog keeps original draft and blocks save.
- Synthetic EditDemo: shared in-memory rows/receipts, success/field/form/403/network/slow timeout outcomes; explicit verification, never demo SQL/API. Parent owns data, accepted results only update displayed records.

## Review focus and steps

1. [x] RED controller tests: deadline/late completion/no retry, lock event boundaries, reconciliation/current errors/newer values, cancellation/new attempt IDs. GREEN compatible extension; run T14 regression.
2. [x] Shared EditSession/Dialog/Table + scoped navigation. Verify forced ending and consumer cancellation preserve T14 behavior. Stable source refresh cannot silently replace draft; one-row concurrency explicit.
3. [x] Memory example, brand variables/copy, normal password gate. Unit and actual component controls for timing/close/repeat/refresh/late response. Verify keyboard focus and narrow scroll.
4. [x] Real isolated0008 SQL/HTTP/password-browser run: row/modal success/error/timeout, dirty scoped cancel, backdrop/Escape/lock, CLI revoke while waiting/dirty. No root0004/.env/presentation/human changes.
5. [x] Appropriate suite/typecheck, final source point/evidence/limits; cleanup own resources, local commit, TL handoff.
