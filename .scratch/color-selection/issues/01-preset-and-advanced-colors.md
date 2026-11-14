# 01: Choose preset colors with expandable advanced controls

**What to build:** Make every existing color setting easy to use with a compact preset-swatch palette inspired by Excalidraw. Display Background, English, Chinese, and Footer as four full-width rows, each with its label, swatches, and Advanced disclosure on one line when space permits. Advanced controls expand below their own row; narrow screens may wrap. Move the visible selected-HEX line out of the layout while retaining an accessible current value and swatch checkmark. Users who need a custom color can expand advanced controls for a custom picker and editable HEX and RGB values. This changes the selection interface, not the viewer's default colors.

**Blocked by:** None (can start immediately). Queue after auto-fit to avoid concurrent edits to shared settings UI and tests; this is an execution order, not a functional dependency.

**created:** 2026-11-14

**Status:** completed

**Assignment:** Terra, high reasoning; orchestrator reviews changes and independently reruns tests.

- [x] Background, English, Chinese, and footer color settings each expose a compact, consistent preset-swatch palette by default, inspired by Excalidraw's color-selection approach.
- [x] Each color setting has an explicitly labeled advanced section that is collapsed initially and can be expanded or collapsed without changing the selected color.
- [x] Advanced controls provide a custom color picker and editable HEX and RGB inputs without relying solely on browser-native picker capabilities.
- [x] Choosing a swatch, custom-picker color, or valid HEX/RGB value synchronizes the other controls for that setting; the current selection is identifiable, including when it is not a preset.
- [x] Invalid or incomplete custom values are clearly indicated and cannot corrupt saved colors; RGB channels accept only valid values in the 0–255 range.
- [x] Existing default colors and saved custom colors remain unchanged and backward compatible; no existing custom value is silently replaced with a preset.
- [x] Save persists selected colors; Skip, Escape, and backdrop dismissal discard unsaved changes; reopening restores the active values, and Reset retains existing default-color behavior.
- [x] Swatches and advanced controls have accessible names, keyboard interaction, and visible focus/selection indicators that do not rely only on color.
- [x] The settings dialog remains usable at supported viewport sizes; auto-fit, display language, and live-refresh behavior remain intact.
- [x] TDD demonstrates meaningful failures before implementation and passing relevant offline tests afterward; real-browser checks cover selection, input validation, keyboard use, expansion, and save/dismiss behavior.
- [x] User-facing documentation explains presets and advanced custom colors.
- [x] Four compact full-width rows keep labels, all swatches, and Advanced disclosures on one line when space permits; advanced controls expand below their own row without overlap, and narrow screens wrap gracefully.
- [x] No visible selected-HEX line adds clutter; current values remain accessible and selected presets retain their checkmarks.
- [x] Regression tests demonstrate the layout failure before refinement and pass in real Chrome at wide and narrow viewports.

## changelog

- 2026-11-14 — implemented approved four-row compact layout refinement and verified browser regressions.
- 2026-11-14 — independently reviewed and verified; ticket completed.
- 2026-11-14 — implemented preset and advanced color controls.
- 2026-11-14 — ticket created from approved two-level color-selection scope.

## Evidence

- Layout refinement red: `node test_colors.cjs` failed with `bg-color full-width row` before implementation.
- Layout refinement green: `node test_colors.cjs`, `node test_layout.cjs`, `node test_viewer.cjs`, `node test_websocket.cjs`, and `python3 test_integration.py` against the live server; Chrome checked compact headers at 500 and 900 pixels wide and wrapping/expansion at 320 × 480.
- Independent orchestrator review: inspected color synchronization, validation, and save/dismiss behavior; reran all four test suites successfully, including Chrome color and layout checks.
- Red: `node test_colors.cjs` failed with `bg-color control exists` before implementation.
- Green: `node test_colors.cjs`, `node test_viewer.cjs`, `node test_websocket.cjs`, and `node test_layout.cjs` passed after implementation. Chrome checks exercised all four palettes, custom values, validation, focus and Escape, save/dismiss/reset, and a 320 × 480 dialog.
- Browser test invokes button clicks and synthetic Escape; it does not simulate trusted Tab/Enter keystrokes or operate the OS-native picker UI. Live OpenLP integration was not run.
- HTML retains CRLF; `git -c core.whitespace=cr-at-eol diff --check` passes (plain `git diff --check` treats CRLF as trailing whitespace).
