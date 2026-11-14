# 01: Refresh lyrics immediately on OpenLP state changes

**What to build:** Listen for OpenLP WebSocket state-change notifications and immediately refresh the live lyrics, reducing polling-related latency while retaining reliable one-second polling as a fallback.

**Blocked by:** None (can start immediately).

**created:** 2026-11-14

**Status:** implemented; awaiting orchestrator review

**Assignment:** Terra, high reasoning; orchestrator reviews changes and independently reruns tests.

- [x] Connect to the configured OpenLP server, discovering its WebSocket port from the system API with a sensible default when discovery is unavailable.
- [x] Valid state notifications refresh lyrics immediately, including slide changes within the same song; do not deduplicate solely on song UUID.
- [x] Initial connection and reconnection refresh the live slide.
- [x] Existing one-second polling remains functional if WebSocket support, discovery, or connectivity is unavailable.
- [x] Malformed or unrelated messages are ignored safely.
- [x] Connection failures reconnect with bounded exponential backoff without duplicate sockets or reconnect timers.
- [x] Saving a new server address or resetting settings reconnects to the correct server; obsolete sockets, discovery responses, and reconnect timers cannot override the new configuration.
- [x] Concurrent polling and notifications cannot allow older HTTP responses to overwrite newer slides; bursts are safely coordinated without dropping a needed final refresh.
- [x] Existing language selection, settings dismissal, blackout, and error/empty-slide behavior remain intact.
- [x] Regression tests use fake WebSockets, timers, and HTTP responses without needing a live server; observe meaningful failures before implementation and pass the complete offline suite afterward.
- [x] Documentation explains push updates, polling fallback, and relevant connection limitations.

## changelog

- 2026-11-14 — ticket created.
- 2026-11-14 — implemented push refresh and polling fallback; offline tests pass, pending orchestrator review and live verification.
- 2026-11-14 — bounded live-slide and discovery requests, including JSON parsing; added timeout and empty-item notification regressions.
- 2026-11-14 — added Blob-frame decoding and current-socket/generation checks after decoding. TDD red: `node test_websocket.cjs` failed because a binary notification produced no refresh; green: `node test_viewer.cjs` and `node test_websocket.cjs` both passed, including malformed/rejected Blob and stale decode cases. Read-only `python3 test_integration.py` passed against 192.168.1.212:4316. Preserved CRLF in the HTML; `git diff --check` reports CRLF as trailing whitespace in added HTML lines.
