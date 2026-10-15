# T17 implementation plan

Goal: reusable single-image preview with explicit gallery, per-image fallback, optional bounded zoom/pan; Gitea#18/#1 stories87–89. Team-authorized autonomous choices below, no new dependencies/API/SQL or external photos. Existing React/Next stack and brand, original0004/config/human untouched.

## Design choices

- shared/image-preview.mjs + declaration: normalized safe sources/unique IDs/required alt, immutable controller snapshots with per-image attempt tokens, sequential fallback and terminal failures. Cached results live only in the instance; canceled pending attempt resumes same source on explicit revisit. Gallery opt-in only, no next-as-fallback.
- Browser loader uses native Image/load/decode, cancellation cleanup and stale attempt checks; project may supply a real authorized loader adapter. Image errors alone do not imply session loss; session-ending always ends preview. Prop descriptor/config changes replace instance/close old dialog, invalidate pending loads; no hidden retry button.
- Native modal close button/backdrop/Escape, image click never closes. Close focus returns existing eligible opener, trap Tab, no edit guards. Backdrop down/up must both originate outside content, so drags cannot accidentally close.
- Default aspect-fit/no upscaling, optional zoom1–4 relative to fit (maxScale project1–8 integer), center anchor. Buttons and +/-/0 keys, single-pointer mouse/touch drag and arrow-key pan, clamp edges; viewport resize resets to fit. No pinch, crop/rotate/editor.
- elements.images {zoomPan:false,maxScale:4} defaultable whole branch, strict explicit shape. Gallery lists remain required consumer data. Pure public code-generated SVG assets and protected examples, no source business images.

## Steps

- [x] RED source/token/gallery/geometry/config tests, then minimal GREEN controller; exact stale/cancel/failed/fit boundaries.
- [x] React thumbnail/dialog/native loader/optional adapter, brand/copy, synthetic assets/examples; config/CLI/typecheck/build.
- [x] Controlled actual-component race/fallback/source replacement/end tests plus real normal password browser desktop/touch/focus/close/zoom/resize/failed/navigation; fixture production404.
- [x] Appropriate full regression/final source evidence; contracts/docs, cleanup owned space/containers/credential files, local commit/TL report.
