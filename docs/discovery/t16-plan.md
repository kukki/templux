# T16 implementation plan

Goal: reusable top notifications with visible-only deadlines, explicit-key merging and bounded FIFO overflow; Gitea#17/#1 stories83–84. Existing stack React/Next/Node24, no dependencies or SQL/API changes. Execute inline under Team assignment; independent review follows delivery, no additional design approval.

## Design calls

- shared/notifications.mjs + declaration: monotonic injected clock, immutable cached snapshots; enqueue/close/pause/limit/tick/clear/end. Visible3/1 at700px, duration15000ms. Four severities, all FIFO. Optional call duration, first keyed content retained, merge count only. Waiting capacity50 (1–500), visible1–10; no ended history.
- Shrink moves tail visible items to a bounded suspended list, freezes remaining and removes DOM pause reasons; restore suspended before FIFO never-visible queue. No overflow eviction of previously visible items. Time caught up on resume; promotions start at actual reconciliation time, not historical deadline.
- React viewport subscribes store, schedules100ms progress reconciliation and visibility/pageshow recovery. Hover(mouse)/focus reasons union, no touch body pause gesture. Stable close buttons, constrained long text scroll, no autofocus on arrival; restore focus on removal only if inside removed item. One polite live announcement separate from ticking progress. Session-ending ends/clears store synchronously.
- Existing notifications configuration gains defaultable queueCapacity, missing entire branch defaults, explicit incomplete/invalid fails (legacy three values gets capacity50). Project runtime restart semantics retained; do not edit actual presentation.
- Pure memory protected example: explicit title/body/severity/key, publish same key/no key/burst/long content and reset. Shared code never imports examples. No maintenance/message-center/outbound notices.

## Steps

- [x] Write failing deterministic controller/config tests: precise expiry, FIFO, pauses union, merge content/time, overflow, resize/restore, cleanup and invalid boundaries. Observe RED, implement GREEN.
- [x] Shared React viewport, config/copy and synthetic example; verify typecheck/build and controlled component timing/pointer/focus tests.
- [x] Normal password isolated Web browser: default15s, hover/focus/remaining, keyed and no-key/queue/overflow, breakpoint, long text/narrow/close focus, session invalidation clearing; screenshots. No original0004/.env/presentation/human changes.
- [x] Appropriate regression and final-source evidence; document limitations, finish own browser/containers/credentials, local commit and TL handoff.
