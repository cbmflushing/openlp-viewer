# 01: Build the live-update module

**What to build:** A deep live-update module that delivers fresh OpenLP slide data and errors through callbacks, concentrating connection lifetime and freshness guarantees behind one seam. Introduce it alongside the existing viewer coordination until ticket 02 switches the caller.

**Blocked by:** None (can start immediately).

**created:** 2026-11-14

**Status:** done

## Agreed constraints

- Preserve behavior rather than add live-update features.
- Keep standalone HTML distribution, direct browser opening, and no build step.
- Keep connection state private. Expose a small lifecycle interface to start for a server, switch servers, and stop.
- Supply onData and onError callbacks at creation. Only current-connection results may reach them.
- Own fetching, polling, WebSocket discovery, reconnects, timeouts, and stale-result rejection; keep slide parsing and all presentation outside the implementation.
- Supply limited network and clock adapters directly for deterministic tests; production uses browser capabilities. Do not introduce a general-purpose framework.

## Acceptance criteria

- [x] Write regression tests first and record meaningful red evidence before the implementation makes them green.
- [x] Poll every second as fallback and refresh immediately on relevant WebSocket notifications, preserving push/poll coalescing and not starving slow valid requests.
- [x] Preserve five-second timeouts covering both fetch and JSON parsing, including operation without AbortController support.
- [x] Discover the WebSocket port, fall back to 4317, and preserve bounded reconnect backoff from two seconds to thirty seconds.
- [x] Preserve text and Blob notification handling, ignoring malformed or unrelated notifications.
- [x] Server switching rejects old request completions, old errors, old discovery results, and old socket notifications, including delayed Blob decoding.
- [x] Stop invalidates in-flight work, closes the socket, and clears owned polling, reconnect, and request timers; abandoned work cannot invoke callbacks or restart activity.
- [x] Successful empty-slide data is delivered as data, not as an error. Current request failures invoke onError without inventing an empty slide.
- [x] Tests exercise the module interface with controlled network and clock adapters, not private counters or display DOM.
- [x] Existing viewer behavior remains operational while the new module is introduced alongside it.

## changelog

- 2026-11-14 — ticket created from approved design and implementation queue.
- 2026-11-14 — module implemented alongside existing coordination; interface regression tests and red/green evidence recorded in `../evidence/01-tdd.md`.
