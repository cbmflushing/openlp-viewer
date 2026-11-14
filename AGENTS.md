# Development Preferences

## Orchestration and tickets

- Act as an orchestrator: break requested work into a queue using the `to-tickets` skill, then delegate implementation to subagents.
- Use local tickets under `.scratch/<feature-slug>/issues/`, one file per ticket, with explicit blocking dependencies and acceptance criteria.
- Confirm the proposed breakdown before starting implementation. Work on tickets whose blockers are complete.
- Default implementation subagents to **Terra**, with **high** reasoning, unless the user specifies otherwise. Use **Sol** subagents for difficult work.

## Test-driven development

- Use TDD: write regression tests first, run them and observe meaningful failures, then make the smallest implementation change needed to pass.
- Rerun relevant tests after implementation; report red/green evidence and any checks that could not run.
- The orchestrator reviews the resulting changes and independently reruns relevant tests before reporting completion.

## Preserve existing work

- Preserve unrelated uncommitted changes, including existing untracked files.
- Do not commit changes unless requested.
