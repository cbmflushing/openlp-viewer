# 01: Dismiss settings popup

**What to build:** Allow the CBM Lyrics Display settings popup to be dismissed with Escape or by clicking outside the dialog, while preserving existing settings controls and display shortcuts.

**Blocked by:** None (can start immediately).

**created:** 2026-11-14

**Status:** completed

- [x] Escape dismisses the popup, including when a settings input has focus.
- [x] Clicking the backdrop dismisses the popup; clicking inside does not.
- [x] Existing Save, Cancel, reopening, and display shortcuts continue to work.
- [x] Dismissal follows existing Cancel behavior without saving unsaved form edits.
- [x] Regression tests are written and observed failing before implementation, then pass after the change.
- [x] Existing uncommitted work is preserved.

## changelog

- 2026-11-14 — ticket created.
- 2026-11-14 — implemented dismissal and added offline regression tests.
