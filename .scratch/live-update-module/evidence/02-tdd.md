# Ticket 02 TDD evidence

## Red — caller integration before implementation

Added a spy around the real public module lifecycle in the production viewer harness, with assertions for initial start, saved server switch, reset and rendered data. Command: `node test_websocket.cjs` (exit 1):

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   [
-     'start',
-     'localhost:4316'
-   ]
- ]

    at /Users/andrew/code/cbm/openlp/openlp-viewer/test_websocket.cjs:51:12 {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: [],
  expected: [Array],
  operator: 'deepStrictEqual',
  diff: 'simple'
}
```

The actual viewer had not called the new lifecycle at all.

## Integration and browser test adjustment

After integration, an initial `node test_layout.cjs` run failed with `Error: resized smaller: wrapping/overflow`. The first migration used zero-delay timers to wait for async fetch completion; under Chrome virtual time this changed resize-event timing and left the original 182.84px font at the smaller width. The browser test now flushes promise microtasks instead, still invoking the actual module poll and keeping every original layout assertion. The resize check then passed without changing production layout behavior.

## Green — final checks

Commands (all exit 0):

```text
$ node test_viewer.cjs
All offline viewer regression tests passed.
$ node test_websocket.cjs
All offline WebSocket regression tests passed.
$ node test_live_update.cjs
All live-update module tests passed.
$ node test_layout.cjs
Browser layout checks passed: { ok: true, short: 182.84, long: 24.3073, many: 34.2773 }
$ node test_colors.cjs
Browser color checks passed: { ok: true }
$ git -c core.whitespace=cr-at-eol diff --check
```

Live-server `test_integration.py` was not run: it requires a live OpenLP server.
