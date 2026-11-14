# 02: Connect the viewer to the live-update module

**What to build:** Route the actual viewer through the deep live-update module, preserving live lyrics, settings, and failure behavior while deleting the superseded shared coordination implementation.

**Blocked by:** 01 — Build the live-update module.

**created:** 2026-11-14

**Status:** done (independent review passed; see ../evidence/03-review.md)

## Acceptance criteria

- [x] Add or adapt caller-level regression tests first and record meaningful red/green evidence for the integration.
- [x] Fresh data reaches existing presentation through onData; errors reach existing error presentation through onError.
- [x] Presentation retains ownership of selected-slide interpretation, lyric parsing, language filtering, title/footer, fitting, fade, and local blackout.
- [x] Successful empty slides clear/fade the display; request failures preserve the last display and report the error; stale failures cannot change current presentation.
- [x] Initial startup, saved server changes, and reset use the module lifecycle rather than manipulating connection internals.
- [x] Remove old shared coordination globals and duplicate coordination paths after all production callers migrate.
- [x] Migrate timing/race tests to the module interface; keep caller-level and real-browser presentation checks. Avoid broad test-harness consolidation unrelated to this refactor.
- [x] Preserve all ticket 01 connection guarantees, standalone HTML distribution, direct browser opening, and no build or production dependencies.
- [x] Relevant offline regression and real-browser checks pass without relaxing existing behavioral assertions.

## changelog

- 2026-11-14 — ticket created from approved design and implementation queue.
- 2026-11-14 — implementation and regression checks completed; evidence in `../evidence/02-tdd.md` and `../evidence/02-result.md`; ticket 03 owns independent review.
