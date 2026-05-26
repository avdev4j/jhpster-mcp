# jhipster-mcp — Improvement Roadmap

Living document for evolving the server beyond its initial 8-tool / 1-resource baseline.
Update the **Status** column as items land. Newest decisions at the bottom of the log.

Status legend: ⬜ not started · 🟡 in progress · ✅ done · ❄️ deferred

## Tier 1 — biggest UX wins

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Progress streaming** — emit MCP `notifications/progress` from `runJhipster` as `jhipster` writes output, instead of buffering until exit. | ✅ | Done 2026-05-19. `onData` hook in [src/jhipster.ts](src/jhipster.ts); reporter in [src/progress.ts](src/progress.ts) reads `extra._meta.progressToken` + `extra.sendNotification`, emits one note per non-empty line. Wired into all jhipster-spawning tools. Tested in [test/progress.test.ts](test/progress.test.ts) + [test/tools/progressStreaming.test.ts](test/tools/progressStreaming.test.ts). |
| 2 | **JDL validation + dry-run** — `validate_jdl` tool and a `dryRun` flag on apply tools, so bad JDL is caught before a multi-minute generator run. | ✅ | Done 2026-05-19. `quickLintJdl` (local, no spawn) in [src/jdl/builders.ts](src/jdl/builders.ts); `validate_jdl` tool ([src/tools/validateJdl.ts](src/tools/validateJdl.ts)) lints then runs `jhipster jdl --dry-run --skip-install` in a temp dir (or a given project). Shared `applyJdl` helper ([src/apply.ts](src/apply.ts)) adds a `dryRun` flag (temp-file + `--dry-run`, zero writes) to all five applying tools. ⚠️ relies on `jhipster --dry-run`; confirm against a real CLI. |
| 3 | **Structured output** — return `structuredContent` + `outputSchema` ({ entities, filesChanged, warnings, exitCode, success, dryRun, command }) alongside the text. | ✅ | Done 2026-05-19. Parser + shared zod shape in [src/result.ts](src/result.ts) (ANSI strip, Yeoman file-action lines, entity extraction, warnings). All 9 jhipster-running tools declare `outputSchema` and return `structuredContent`. Pre-spawn guard errors stay `isError` (SDK skips validation). Tested in [test/result.test.ts](test/result.test.ts) + [test/tools/structuredOutput.test.ts](test/tools/structuredOutput.test.ts). |

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
- **2026-05-19** — ✅ Tier 1 #2 JDL validation + dry-run shipped (`validate_jdl` tool, `dryRun` flag on all applying tools via shared `applyJdl`, `quickLintJdl`). Tool count now 9. ⚠️ Open follow-up: verify `jhipster jdl --dry-run` behavior against a working real CLI (the dev box's global jhipster was broken). Next up: Tier 1 #3 (structured output).
- **2026-05-19** — ✅ Tier 1 #3 structured output shipped. **Tier 1 complete.** All 9 tools return `structuredContent` against a shared `outputSchema`. ⚠️ Open follow-up: the `filesChanged`/`warnings` parser ([src/result.ts](src/result.ts)) is regex-based on Yeoman output; validate against real generator output once the CLI works (line formats may differ across JHipster versions). Next: Tier 2 #4 (project-state resources).
