# 01: Automatically fit lyrics to the available display area

**What to build:** Automatically display lyrics at the largest size that fits the available width and height without introducing line wrapping. Enable auto-fit by default, with a settings toggle to restore the existing fixed-size behavior. Scale English and Chinese together while preserving their relative size.

**Blocked by:** None (can start immediately).

**created:** 2026-11-14

**Status:** completed

**Assignment:** Terra, high reasoning; escalate difficult layout work to Sol. Orchestrator reviews changes and independently reruns tests.

- [x] Auto-fit is enabled for new users and existing saved settings without an auto-fit preference.
- [x] Settings expose an auto-fit toggle; saving persists it across reloads, dismissal discards draft changes, and Reset restores enabled auto-fit.
- [x] With auto-fit enabled, lyrics grow to the largest fitting size within a documented measurement tolerance, bounded by both the longest line's width and the complete lyric block's height.
- [x] OpenLP's line breaks are preserved; auto-fit does not introduce wrapping, clip lines, or create scrollbars on supported display sizes.
- [x] English and Chinese scale together while preserving their existing relative size; English-only mode measures only displayed lyrics.
- [x] Layout reserves margins and space for the visible song title and footer so lyrics do not overlap them.
- [x] Fit is recalculated after slide changes, viewport resizing, font selection or font loading, and changes to language or title/footer settings that affect available space.
- [x] Sizing is measured before revealing updated lyrics, avoiding visible intermediate resizing or flicker.
- [x] Disabling auto-fit restores the existing font-size behavior.
- [x] Empty slides, blackout, network-error behavior, modal dismissal, and WebSocket/polling refresh remain intact; repeated unchanged refreshes do not cause visible layout jitter.
- [x] TDD demonstrates meaningful failing tests before implementation, then passes the complete offline suite. Layout validation includes real-browser measurements for short and long lines, many-line slides, bilingual and English-only modes, viewport resizing, and delayed font loading.
- [x] User-facing documentation explains the default, toggle, and any practical display-size limitations.

## Evidence

- Red: `node test_viewer.cjs` failed on legacy settings lacking the default; `node test_layout.cjs` failed because a long line did not shrink.
- Green: `node test_viewer.cjs`, `node test_websocket.cjs`, and `node test_layout.cjs` pass. Chrome checks real layout, maximum tolerance, short/long/many lines, bilingual/English-only, resize, blackout recovery, unchanged refresh, disabled clamps, and delayed FontFace loading.
- Independent orchestrator review: inspected sizing logic and browser assertions; reran `node test_viewer.cjs`, `node test_websocket.cjs`, and `node test_layout.cjs` successfully.
- Live OpenLP integration was not rerun for this layout change. Very small windows and unusually large title/footer text cannot guarantee usable lyrics; see README.

## changelog

- 2026-11-14 — independently reviewed and verified; ticket completed.
- 2026-11-14 — implemented and tested.
- 2026-11-14 — ticket created from approved auto-fit scope.
