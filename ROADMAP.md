# jhipster-mcp — Improvement Roadmap

Living document for evolving the server beyond its initial 8-tool / 1-resource baseline.
Update the **Status** column as items land. Newest decisions at the bottom of the log.

Status legend: ⬜ not started · 🟡 in progress · ✅ done · ❄️ deferred

## Tier 1 — biggest UX wins

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Progress streaming** — emit MCP `notifications/progress` from `runJhipster` as `jhipster` writes output, instead of buffering until exit. | ✅ | Done 2026-05-19. `onData` hook in [src/jhipster.ts](src/jhipster.ts); reporter in [src/progress.ts](src/progress.ts) reads `extra._meta.progressToken` + `extra.sendNotification`, emits one note per non-empty line. Wired into all jhipster-spawning tools. Tested in [test/progress.test.ts](test/progress.test.ts) + [test/tools/progressStreaming.test.ts](test/tools/progressStreaming.test.ts). |
| 2 | **JDL validation + dry-run** — `validate_jdl` tool and a `dryRun` flag on apply tools, so bad JDL is caught before a multi-minute generator run. | ⬜ | Use JHipster's JDL parser (`jhipster jdl --json-only` or the parser lib) to lint without generating. Preview which entities/files would change. |
| 3 | **Structured output** — return `structuredContent` + `outputSchema` ({ entitiesCreated, filesChanged, warnings, exitCode }) alongside the text. | ⬜ | Agents reason on JSON instead of regex-ing the formatted string. Parse generator stdout / diff the dir. |

## Tier 2 — richer model awareness

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4 | **Project-state resources** — `jhipster://project/yo-rc`, `.../entities`, `.../jdl` (via `export-jdl`). | ⬜ | Resource templates so the agent reads current state cheaply instead of guessing; reduces destructive edits. |
| 5 | **Tool annotations** — `readOnlyHint` (`info`), `destructiveHint`/`idempotentHint` (`create_app_from_jdl`). | ⬜ | Lets hosts auto-approve safe tools, confirm risky ones. |
| 6 | **MCP Prompts** — reusable templates: "scaffold CRUD monolith", "add audit fields to all entities", "monolith → microservices". | ⬜ | Surface as slash commands in the host; encode best practices. |

## Tier 3 — safety & control

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7 | **Safe-apply with rollback** — snapshot (git stash/commit or backup dir) before `--force` overwrites; surface a diff summary. | ⬜ | One revert away from a bad generation. |
| 8 | **Elicitation for missing config** — use MCP elicitation to ask DB/auth/client when JDL config is ambiguous. | ⬜ | Turns one-shot tools into a conversation. |
| 9 | **Config & sandboxing** — env/config for a `workingDirectory` root the server refuses to escape, pinned generator version, default flags. | ⬜ | Safe to expose to less-trusted hosts. |

## Tier 4 — reach

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10 | **Blueprint support** (`--blueprints`). | ⬜ | |
| 11 | **Deployment tools** — dedicated `kubernetes` / `docker-compose` tools (currently only reachable via `run_jhipster` allowlist). | ⬜ | |
| 12 | **Post-gen helpers** — report build/run commands without running them. | ⬜ | Stays within the "no builds/run/git" scope. |

## Design principles to preserve

- Non-interactive always (`--force --skip-git`, `CI=true`).
- No shell (`spawn` with `shell: false`); validate user-influenced args.
- Build JDL via the validated builders in [src/jdl/builders.ts](src/jdl/builders.ts), never hand-concatenate.
- Every tool takes an absolute `workingDirectory`.
- Keep the test approach: `node:test` + `tsx`, in-memory MCP pair, fake `jhipster` on PATH.

## Decision log

- **2026-05-19** — Roadmap created. Starting with Tier 1 #1 (progress streaming). Remaining items tracked here for future sessions.
- **2026-05-19** — ✅ Tier 1 #1 progress streaming shipped. Next up: Tier 1 #2 (JDL validation + dry-run).
