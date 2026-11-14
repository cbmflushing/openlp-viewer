# OpenLP Viewer — Agent Guide

## Overview and run

`lyrics-display.html` is a standalone browser page for presenting live English and Chinese OpenLP lyrics on a second screen. Its HTML, CSS, JavaScript and connection module are in one file; no build or runtime installation is required. Open the file in a browser, enable OpenLP's remote server, and enter its host and HTTP port (default `localhost:4316`) in settings. The viewer expects unauthenticated API access. See `README.md` for controls and troubleshooting.

Settings persist in browser `localStorage` under `cbmDisplaySettings`; defaults are merged into saved settings. Reset restores defaults and reconnects. The viewer uses HTTP and unencrypted WebSockets: HTTPS hosting may cause mixed-content blocking, and browser CORS policy can also prevent requests. Use a trusted network and trusted slide content: English formatting is inserted as HTML. The footer identifies CBM Flushing; the CCLI number is configurable.

## Architecture and invariants

- `createLiveUpdate` in `lyrics-display.html` owns networking, timers, cancellation and connection lifetime. It reads `/api/controller/live/text` (v1) and discovers the WebSocket port using `/api/v2/core/system`; no WebSocket support means polling only. The module is delimited by `BEGIN live-update module` and `END live-update module` comments, which tests use to extract it.
- `start(server)` performs an immediate read, starts one-second fallback polling and discovers a WebSocket. `switchServer(server)` is the same lifecycle operation, even for the same server. Both replace the previous lifetime. `stop()` invalidates outstanding work, closes the socket and clears owned timers; it is idempotent and permits a later restart.
- Only current results reach `onData` (raw parsed JSON) or `onError` (live-slide request failures). An in-flight read is not invalidated by a poll; push refreshes coalesce and supersede older results. Requests, including JSON parsing, time out after five seconds even without working abort support. Discovery falls back to port `4317`; reconnect backoff grows from two to thirty seconds and resets on open. Stop or server replacement suppresses stale reads, errors, discovery and delayed Blob notifications. Only WebSocket messages with a string `results.item` trigger refresh.
- Tests may pass `network` (`fetch`, `WebSocket`, `AbortController`, `Blob`, `URL`) and `clock` (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`) adapters to `createLiveUpdate`. Each supplied adapter replaces the corresponding default object, rather than merging individual methods; production uses browser defaults.
- The presentation layer (`displayLiveData`, `displayLiveError`, `parseSlideLines`, `fitLyrics`) interprets selected slides, language, title/footer, sizing and fade. Keep it separate from connection ownership. A successful response with no visible selected lyrics clears and fades the display; network errors report an error and preserve the last display. Local blackout (`.`) is independent of OpenLP blackout. A settings save reconnects only if the server changes; reset always reconnects.
- Parsing classifies a whole line as Chinese when over 30% of visible non-whitespace characters are Chinese; Chinese whitespace is removed and duplicates collapse. English lines precede Chinese lines. English retains trusted HTML formatting; Chinese is escaped. Auto-fit measures a clone, preserves line breaks and the language size ratio, and reserves title/footer space. Resize and font loading can trigger remeasurement; real browser tests are important for layout changes.

## Tests and validation

From this directory, the offline tests require Node.js; the hook and ignore tests also require Git and use temporary repositories:

```sh
node test_viewer.cjs
node test_websocket.cjs
node test_live_update.cjs
node test_gitignore.cjs
node --test test_version_hook.cjs
```

Real-browser tests require Google Chrome at their built-in default path, or an explicit Chromium executable path. `test_tablet.cjs` also requires Node.js 22 or newer for built-in fetch and WebSocket support:

```sh
node test_layout.cjs
node test_colors.cjs
node test_sketch.cjs
node test_tablet.cjs
node test_version.cjs
```

Pass a Chromium executable path as the first argument to any of these commands to override the default. `python3 test_integration.py` requires a reachable live OpenLP server and tests connectivity before its Python parsing mirrors. Its `SERVER` is hard-coded; inspect it before running and adjust it locally only if appropriate. It does not accept a server argument, and is not an offline test. Do not silently change its existing default. The parent project notes may describe an older server or implementation; verify behavior here against current source.

## Version hook

`VIEWER_VERSION` is a single declaration in the HTML, displayed in settings, not a user preference. `node scripts/install-version-hook.cjs` optionally installs a local pre-commit hook; it is idempotent and refuses configured `core.hooksPath` or a different existing hook. Do not install it automatically. `scripts/bump-viewer-version.cjs` requires the first versioned commit to introduce `1.0.0`; later hook-invoking commits bump the minor component from `HEAD` and reset patch to zero, even without other viewer changes. It updates and stages only the HTML. A failed commit can leave that bump staged; retry from unchanged `HEAD` derives the same version.

The hook rejects unmerged or unstaged HTML, assume-unchanged/skip-worktree flags, and alternate or temporary indexes (including path-limited commits). Stage or stash HTML edits, then use a normal commit without path arguments. It does not overwrite other staged files. Hooks are local, bypassable, and not run by every Git operation; custom filters rewriting the declaration are unsupported. See `README.md` for contributor installation and limitations. Preserve existing versioning work and never stage or commit unless requested.

## Repository hygiene

- Do not read `.env` files or secret-bearing local settings. Do not put credentials, local machine paths or private-network addresses into published examples.
- `.gitignore` keeps `.scratch/`, local settings, environment files, dependencies, caches and logs local. Keep temporary working notes and raw evidence under `.scratch/`; do not force-add them. Approved tickets and concise development/test history belong in GitHub Issues. Ignoring or untracking files does not remove prior Git history.
- Preserve the existing CRLF line endings in `lyrics-display.html`. For whitespace validation use `git -c core.whitespace=cr-at-eol diff --check`.
- `prompt.md` is a historical review, not an authoritative description of current behavior. Verify its claims against source and tests.
- Do not use emojis.

# Development Preferences

## Orchestration and tickets

- Act as an orchestrator: break requested work into a queue using the `to-tickets` skill, then delegate implementation to subagents.
- Use GitHub Issues in `cbmflushing/openlp-viewer` as the source of truth for approved tickets, not local `.scratch/` ticket files. Propose the breakdown first; publish one issue per approved ticket with acceptance criteria, explicit blocking dependencies (issue references or None), a `created` date, and a concise newest-first changelog. Use `gh` when available.
- Ticket approval authorizes publication, not implementation. Start implementation only when the user authorizes it and blockers are complete. Label deferred approved issues `on hold`; do not mark them `ready-for-agent` until implementation is authorized and blockers are complete.
- Use `.scratch/` only for temporary working notes and raw evidence. When migrating local tickets, leave a pointer to the canonical issue rather than maintain duplicate ticket specifications. Do not publish secrets, private addresses, or machine-specific paths.
- Post concise implementation, test/red-green evidence, and independent review summaries as issue comments. Reference issue numbers in commits or pull requests when authorized; close issues only after delivery. Do not migrate historical work or close parent issues without authorization.
- Default implementation subagents to **Terra**, with **xhigh** reasoning, unless the user specifies otherwise. Use **Sol** subagents for difficult work.

## Test-driven development

- Use TDD: write regression tests first, run them and observe meaningful failures, then make the smallest implementation change needed to pass.
- Rerun relevant tests after implementation; report red/green evidence and any checks that could not run.
- The orchestrator reviews the resulting changes and independently reruns relevant tests before reporting completion.

## Preserve existing work

- Preserve unrelated uncommitted changes, including existing untracked files.
- Do not commit changes unless requested.
