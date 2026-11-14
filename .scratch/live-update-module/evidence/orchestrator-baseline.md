# Independent baseline

Before ticket 01 implementation, the orchestrator ran:

```sh
node test_viewer.cjs && node test_websocket.cjs && node test_layout.cjs && node test_colors.cjs
```

All four passed:
- All offline viewer regression tests passed.
- All offline WebSocket regression tests passed.
- Browser layout checks passed: { ok: true, short: 182.84, long: 24.3073, many: 34.2773 }
- Browser color checks passed: { ok: true }

Live-server Python integration has not been run.

Delegation: ticket 01 launched using `pi --provider openai-codex --model gpt-6.1-terra --thinking xhigh --no-session -p`, with direct shared-workspace edits and explicit restriction to ticket 01.
