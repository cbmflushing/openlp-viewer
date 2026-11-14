# 01: Choose bilingual or English-only lyrics

**What to build:** Add a display-language setting with English + Chinese as the default and English only as an alternative, using the existing Chinese-line classification. Remember the choice across reloads. Chinese-only mode is deferred.

**Blocked by:** None (can start immediately).

**created:** 2026-11-14

**Status:** implemented; awaiting orchestrator review

**Assignment:** Terra, high reasoning; orchestrator reviews changes and independently reruns tests.

- [x] Settings offer English + Chinese (default) and English only; no Chinese-only option.
- [x] Existing saved settings without a language preference retain bilingual behavior.
- [x] English-only mode excludes identified Chinese lyric lines while preserving English formatting and ordering.
- [x] Save applies the choice by the next normal display refresh and persists it across reloads.
- [x] Dismissing settings without saving leaves the active language preference unchanged; reopening restores the saved choice.
- [x] Reset restores bilingual mode.
- [x] A slide with no visible lyrics after language filtering follows existing empty-slide behavior instead of leaving stale content.
- [x] Existing title/footer behavior, shortcuts, modal dismissal, and network-error behavior remain intact.
- [x] Tests are written first and observed failing before minimal implementation; the complete offline suite passes afterward.
- [x] User-facing documentation describes the language choices and default.

## changelog

- 2026-11-14 — ticket created; Chinese-only mode deferred.
- 2026-11-14 — implemented with offline regression coverage; awaiting orchestrator review.
