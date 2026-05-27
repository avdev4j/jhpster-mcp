# jhipster-mcp — Improvement Roadmap

Living document for evolving the server beyond its initial 8-tool / 1-resource baseline.
Update the **Status** column as items land. Newest decisions at the bottom of the log.

Status legend: ⬜ not started · 🟡 in progress · ✅ done · ❄️ deferred

## Tier 1 — biggest UX wins

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Progress streaming** — emit MCP `notifications/progress` from `runJhipster` as `jhipster` writes output, instead of buffering until exit. | ✅ | Done 2026-05-19. `onData` hook in [src/jhipster.ts](src/jhipster.ts); reporter in [src/progress.ts](src/progress.ts) reads `extra._meta.progressToken` + `extra.sendNotification`, emits one note per non-empty line. Wired into all jhipster-spawning tools. Tested in [test/progress.test.ts](test/progress.test.ts) + [test/tools/progressStreaming.test.ts](test/tools/progressStreaming.test.ts). |
| 2 | **JDL validation + dry-run** — `validate_jdl` tool and a `dryRun` flag on apply tools, so bad JDL is caught before a multi-minute generator run. | ✅ | Done 2026-05-19. `quickLintJdl` (local, no spawn) in [src/jdl/builders.ts](src/jdl/builders.ts). **Validated against real jhipster 9.0.0: `--dry-run` does NOT prevent writes (only prints conflicts).** Reworked to **temp-dir isolation** — `runJdlIsolated` ([src/apply.ts](src/apply.ts)) copies the project's `.yo-rc.json`/`.jhipster` into a throwaway dir, generates there, parses output, discards. `validate_jdl` and the `dryRun` flag on all five applying tools use it. Confirmed against real CLI: project dir 0→0 files, 165 generated in temp. |
| 3 | **Structured output** — return `structuredContent` + `outputSchema` ({ entities, filesChanged, warnings, exitCode, success, dryRun, command }) alongside the text. | ✅ | Done 2026-05-19. Parser + shared zod shape in [src/result.ts](src/result.ts) (ANSI strip, Yeoman file-action lines, entity extraction, warnings). All 9 jhipster-running tools declare `outputSchema` and return `structuredContent`. Pre-spawn guard errors stay `isError` (SDK skips validation). Tested in [test/result.test.ts](test/result.test.ts) + [test/tools/structuredOutput.test.ts](test/tools/structuredOutput.test.ts). |

## Tier 2 — richer model awareness

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4 | **Project-state resources** — `jhipster://project/yo-rc`, `.../entities`, `.../jdl` (via `export-jdl`). | ✅ | Done 2026-05-27. Three `ResourceTemplate`s in [src/resources/projectState.ts](src/resources/projectState.ts), each keyed to a project dir via a `{?dir}` query variable. `yo-rc` + `entities` are pure-fs reads; `jdl` runs `export-jdl` in an isolated temp copy (`exportJdlIsolated` in [src/apply.ts](src/apply.ts)) so the project is never written. Tested in [test/resources/projectState.test.ts](test/resources/projectState.test.ts). |
| 5 | **Tool annotations** — `readOnlyHint` (`info`), `destructiveHint`/`idempotentHint` (`create_app_from_jdl`). | ✅ | Done 2026-05-27. `annotations` added to all 9 tools. `info`/`validate_jdl` are `readOnlyHint`; the generator tools are `destructiveHint` (`--force` overwrites), idempotent except `create_app_from_jdl`; `run_jhipster` is also `openWorldHint` (allows deploy subcommands). Verified via `listTools` in [test/tools/annotations.test.ts](test/tools/annotations.test.ts). |
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
- **2026-05-19** — ✅ Tier 1 #3 structured output shipped. **Tier 1 complete.** All 9 tools return `structuredContent` against a shared `outputSchema`.
- **2026-05-19** — Validated both open follow-ups against **real jhipster 9.0.0**:
  - Parser ([src/result.ts](src/result.ts)) ✅ — correctly parsed 165 real `create`/`force` lines (they arrive on **stderr**, which the parser already reads).
  - Dry-run ❌ → **bug found & fixed**: JHipster 9 `--dry-run` only prints conflicts, it still writes. Reworked `dryRun`/`validate_jdl` to **temp-dir isolation** (`runJdlIsolated`), confirmed no-write against the real CLI. All follow-ups now closed.
  - Next: Tier 2 #4 (project-state resources).
- **2026-05-27** — ✅ Tier 2 #4 project-state resources shipped. Three resource templates (`jhipster://project/{yo-rc,entities,jdl}{?dir}`); the dir is passed as a percent-encoded `{?dir}` query var (the SDK matches the template but does **not** auto-decode — handler calls `decodeURIComponent`). `yo-rc`/`entities` read the filesystem directly; `jdl` shells out to `export-jdl` in an isolated temp copy. A no-`dir` URI yields an SDK "resource not found" (-32602) since it doesn't match the template. Next: Tier 2 #5 (tool annotations).
- **2026-05-27** — ✅ Tier 2 #5 tool annotations shipped. All 9 tools carry `annotations`: read-only (`info`, `validate_jdl`); destructive + idempotent (`import_jdl`, `add_entity`, `add_relationship`, `set_option`, `generate_ci_cd`); destructive + non-idempotent (`create_app_from_jdl`); `run_jhipster` adds `openWorldHint: true` (deploy subcommands reach external systems). Annotations are static, so they describe the default `dryRun: false` worst case for the host to gate on. **Tier 2 nearly done — only #6 (MCP Prompts) remains.** Next: Tier 2 #6.
