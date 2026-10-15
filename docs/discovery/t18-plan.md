# T18 implementation plan

Goal: Gitea#19/#1 story90, explicit complete-value clipboard button and local truthful feedback. Team-authorized autonomous implementation; original0004/config/human untouched.

## Design decisions

- Native secure-context Clipboard.writeText only; call immediately in user click, no permissions preflight/deprecated fallback. NotAllowedError is denied, missing API/insecure context unsupported, other rejection generic failure. Never inspect/log error text or copied value. Browser/OS writes cannot be canceled after dispatch.
- Value is string|null|undefined only; empty means null/undefined/zero-length, whitespace exact. Numeric conversion belongs to consumer (String(0)); no business trim. Explicit nonempty accessible label, button-only click, typebutton and stopped bubbling; no interactive link ancestor.
- Shared instance-bound controller immutable snapshots contain no value/label. Pending ignores repeats; Promise resolution alone copied. Success1500ms default, configurable100–60000ms; errors persist until retry. New target/settings/label/adapter create a new controller; cleanup invalidates generation/timer, session ending ends/hides immediately. StrictMode cleanup can invalidate safely without permanently ending a remounted instance.
- elements.copy {feedbackMs:1500,emptyMode:'disable'} whole-branch backward default, enum hide/disable and strict range/shape. No actual presentation mutation. Pure synthetic short/long/empty/explicit rejected demonstration in protected examples, not credential delivery UI.
- React CopyButton consumes public write adapter for platform integration/test failure. Adapter must resolve only after real copy; examples never simulate success. Local fixed messages/live status omit target/error payload, no global notice/storage.

## Review focus

- Whitespace and zero numeric conversion preserve value; long visual ellipsis cannot become copied value.
- Pending duplicate/late completion after target replacement/unmount/end cannot show old success; already dispatched OS write not claimed canceled.
- New click supersedes old success timer; failure never looks successful and retry remains usable.
- Button keyboard/form/row behavior, hidden/disabled empties, no raw value in feedback or diagnostics.
- Real Clipboard write/readback distinct from controlled permission/unsupported adapters; restore only synthetic clipboard changes and document native limitations.

## Tasks

- [x] RED tests/copy.test.mjs: exact input/type/empty, synchronous write dispatch, pending dedupe, success time/repeat, error retry, target invalidation/end/timer generations, legacy/invalid config and CLI. GREEN shared/copy.mjs+.d.mts and additive presentation branch.
- [x] React elements/copy-button.tsx + clipboard.ts + CSS/local copy; examples/copy-demo.tsx and lab; controlled fixture/scenarios for true component race/error/keyboard/hot area/end. Verify typecheck and tool fixture.
- [x] Build checks/web, real native clipboard long-value readback on protected normal-password examples with independent0008 DB; component scenarios for native permission denial/unsupported boundary where feasible, 390px screenshot. Necessary related/full regression, document final source point and precise limits.
- [x] Contract/acceptance/README, cleanup own space/containers/credential artifacts, local commit/TL report. Review by team after completion, no subagents/push/issue close.
