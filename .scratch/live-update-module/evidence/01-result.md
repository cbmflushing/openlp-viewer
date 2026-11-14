# Ticket 01 result

Implemented `createLiveUpdate` in `lyrics-display.html`, alongside (and not connected to) the existing production coordination. The HTML remains standalone with no build step. `README.md` lists the new offline test.

## Interface

```js
const live = createLiveUpdate({ onData, onError });
live.start('localhost:4316');
live.switchServer('other-host:4316');
live.stop();
```

`start` and `switchServer` both replace any active connection, even for the same server; `stop` is idempotent. Callbacks receive raw parsed JSON or the current request's error. No presentation or parsing of slide contents is performed. Optional `network` and `clock` options replace the browser defaults in tests: network supplies `fetch`, `WebSocket` (optional), `AbortController` (optional), `Blob` (optional), and `URL`; clock supplies `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`.

## Design and verification

A closure owns one connection generation, its request cancellations and timers, socket and reconnect state. Push invalidates an active request and queues one final refresh; polls do not invalidate it. Stop/switch invalidate the generation before cleanup, including late asynchronous Blob decoding. Request timeouts race both fetch and JSON parsing and do not rely on abort support. Discovery uses the existing port selection and reconnect behavior.

`test_live_update.cjs` tests only the public interface with fake network and clock; it covers empty data vs errors, polling, push coalescing, binary/invalid messages, timeout and recovery with/without abort, stale results on switch/stop, and bounded backoff. Red/green commands and outputs are in `01-tdd.md`. Existing viewer, WebSocket, browser layout and browser color tests passed. Live OpenLP integration was not run because it requires a live server.

## Handoff / concerns

Ticket 02 must connect the viewer to this seam and remove the old coordination; until then production behavior is intentionally unchanged and both implementations coexist. Adapter injection replaces the entire corresponding default adapter rather than merging individual properties. The existing HTML is CRLF, so plain `git diff --check` treats added CRLF lines as trailing whitespace with this repository's current Git settings; `git -c core.whitespace=cr-at-eol diff --check` is the appropriate check without changing file line endings. `AGENTS.md` was already modified and was left untouched.
