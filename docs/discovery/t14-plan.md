# T14 implementation plan

Goal: ordinary form validation and reusable unsaved edit protection, demonstrated with synthetic browser memory only.
Spec: Gitea #15 / #1 stories 79–80; web-elements.md forms; session-lifecycle.md.
Architecture: pure edit controller owns normalized baseline, validation and save generations; a React adapter renders snapshots; navigation provider coordinates dirty controllers and session-ending. Existing search/filter state is independent.

## Constraints and review focus

- No SQL, business API or production authentication fixture; original deployment0004 untouched.
- Reuse existing brand variables, visible above-field labels, first blur / submit all / recheck errors on change.
- Save snapshot success cannot overwrite edits made while awaiting; repeated submit blocked; reset/unmount/session ending invalidate late responses.
- Dirty compares normalized current values against last acknowledged baseline; failed saves retain changes. Normalization is explicit project policy.
- App anchors and instrumented Next Link/router calls use one confirmation. Browser document traversals use beforeunload; uninstrumented same-document back/forward cannot reliably be cancelled by App Router and is explicitly outside the guard contract. Consumers keep edit routes as document navigations or supply guarded back/forward actions. No popstate rollback/history sentinel.
- 401 uses existing endSession; 403/network remain on editor with error and dirty state.

## Steps

1. [ ] Add failing controller tests for blur/submit/error timing, normalized revert, save edits/concurrency/reset/failure; run RED.
2. [ ] Implement shared controller + declarations and React useEditor/field components; run targeted tests/typecheck.
3. [ ] Implement navigation provider (anchor capture, explicit requestLeave, native beforeunload, ending bypass) and instrumented Next Link; integrate example page and memory form. Keep search untouched.
4. [ ] Controlled real-component fixture tests and production browser: validation, save failure/success, keep/discard, navigation routes, beforeunload boundary and real CLI revoke while dirty. Desktop/narrow screenshots.
5. [ ] Container suite/typecheck, exact evidence/consumer contract, own resources cleanup, local commit and TL handoff.

Execution is native within the assigned Team task; independent review follows TL handoff.
