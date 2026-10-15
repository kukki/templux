# T19 Anchored popover and single panel Implementation Plan

> Native inline execution, team-authorized autonomous decisions. Reuse brainstorming/writing-plans/TDD/frontend patterns; independent team review after delivery.

**Goal:** Gitea#20/#1 story91: distinct anchored auxiliary popover and one nonmodal panel with reusable edit protection.
**Architecture:** Pure placement/panel controller; native auto Popover invoker plus fixed measured placement; one React panel Provider/portal. EditSession exposes a generic close boundary and optional external initial/return focus ownership, preserving existing defaults.
**Tech Stack:** existing React19/Next16/TypeScript, Node24, native Pointer/VisualViewport; no dependencies/API/SQL.
**Spec:** web-elements.md, forms-and-unsaved-edits.md, row-and-dialog-editing.md; eventual anchored-and-floating-panels.md.

## Global constraints

Original0004/.env/actual presentation/Ego31/humans/Feishu untouched, no push/issue close. Pure synthetic example. Desktop nominal min280x180,12px viewport margin, viewport fit takes precedence if smaller. Narrow≤640px bottom max60% visual height (minimum64 where space allows), no free move/resize or scrim. Project provides stable target/version and authoritative save/verify. Native Popover API required; unavailable browsers get disabled entry and local explanation, not a fake popup.

## Design choices and review focus

- Auto native popover preserves nonmodal light dismiss/Escape and invoker relationship; fixed x/y computed from actual anchor+intrinsic content, flips top/bottom and clamps, scroll/resize/VisualViewport/ResizeObserver coalesced; anchor outside viewport closes. No focus trap. Close/Escape returns eligible trigger, outside click preserves chosen focus.
- Panel controller single ID/epoch, same ID focuses existing draft without replacing; new ID/close runs current registered boundary synchronously. Boundary subscribes blocked status so header/replace UI and event paths agree. Cleanup token cannot clear newer target's guard.
- Desktop drag/resize title/handle or keyboard arrows10/Shift40/Home reset; one preferred rect in Provider memory only, viewport constraints derived so shrink/expand/narrow restore safely. Clear memory/end on authorization context unmount; never storage or per-record history.
- Whole panel capture tracks contacts (including content/tools); second/nonprimary cancels and blocks until all contacts end. Windowup/cancel and lostcapture/viewport/epoch/end cleanup, suppress compatibility click after multi/drag; new intentional primary down clears suppression. No pinch/multiwindow layering.
- EditSession registerClose boundary reuses requestDiscard+editor blocked, lock/timeout/verify generation unchanged; initial/return focus optional external owner prevents stale child cleanup stealing replacement focus. Consumer versions/authorization/save receipts remain project responsibility.

## Tasks

- [x] RED pure geometry/controller/config/CLI tests, including flip/constrain/offset viewport, single/guard/epoch/late release, blocked and memory breakpoint cases; GREEN shared overlays/config.
- [x] Native anchored component/useVisualViewport; single panel Provider, pointer/keyboard shell; EditSession close boundary/focus opt-in; protected synthetic info/edit panels with normal/error/wait/timeout+verify. Typecheck/build and appropriate existing edit regression.
- [x] Actual component mouse/keyboard/CDP multi (stage/title + body/toolbar), native popover focus/dismiss/scroll/resize, narrow/viewport, replacement dirty reject/accept/saving/late/unconfirmed/end. Normal password protected entry and real CLI revoke on independent0008; screenshots only if tool succeeds.
- [x] Full/targeted final-source gates as justified, contract/acceptance/README, own resources+credentials cleanup, local commit and TL report. Preserve precise failed attempts/platform limits.
