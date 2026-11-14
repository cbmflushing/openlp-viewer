# Ticket 01 TDD evidence

## Red: before module implementation

Command: `node test_live_update.cjs`

Actual output (exit 1):

```text
node:internal/assert/utils:77
    throw err;
    ^

AssertionError [ERR_ASSERTION]: live-update module must be present in standalone HTML
    at Object.<anonymous> (/Users/andrew/code/cbm/openlp/openlp-viewer/test_live_update.cjs:9:8)
    at Module._compile (node:internal/modules/cjs/loader:1829:14)
    at Object..js (node:internal/modules/cjs/loader:1969:10)
    at Module.load (node:internal/modules/cjs/loader:1552:32)
    at Module._load (node:internal/modules/cjs/loader:1354:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v25.9.0
```

The red establishes that the requested public seam did not exist. Tests were written before implementation; additional interface cases were added after the first green.

## Green

Command: `node test_live_update.cjs` (after all test additions)

```text
All live-update module tests passed.
```

Command: `node test_viewer.cjs && node test_websocket.cjs`

```text
All offline viewer regression tests passed.
All offline WebSocket regression tests passed.
```

Command: `node test_layout.cjs`

```text
Browser layout checks passed: { ok: true, short: 182.84, long: 24.3073, many: 34.2773 }
```

Command: `node test_colors.cjs`

```text
Browser color checks passed: { ok: true }
```

All green commands exited 0. Live integration was not run: it requires an available OpenLP server.
