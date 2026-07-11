# 9. How it works (engine)

← [Advanced usage](08-advanced-and-customization.md) · [Docs index](README.md)

You don't need this page to *use* the server — it's for the curious, and for anyone evaluating whether to trust it with their projects. It mirrors the architecture in [CLAUDE.md](../CLAUDE.md); the source is the ground truth.

## The shape of it

- **Transport:** stdio. Your host launches the server as a child process and speaks MCP over stdin/stdout.
- **Entry point:** `src/index.ts` registers every tool, resource, and prompt, then connects the stdio transport.
- **It spawns your `jhipster`.** The server is a thin adapter; the real work is done by the global `generator-jhipster` on your `PATH`.

```
src/
  index.ts            registers tools + resources + prompts, connects stdio
  config.ts           env-driven sandbox root, default flags, pinned generator version
  jhipster.ts         spawn wrapper around the `jhipster` CLI + result formatting
  apply.ts            applyJdl() — shared persist-vs-dry-run; runJdlIsolated(); exportJdlIsolated()
  progress.ts         streams generator output as MCP progress notifications
  result.ts           parses generator output into the structured result + shared schema
  jdl/builders.ts     pure JDL string builders + quickLintJdl + strict name validation
  tools/*.ts          one tool per file
  resources/*.ts      one resource per file
  prompts/*.ts        one prompt per file
```

## The spawn wrapper (`jhipster.ts`)

All CLI execution funnels through one `runJhipster()` function. It:

- spawns `jhipster` with **`shell: false`** via `cross-spawn` (no shell, so no metacharacter injection — while still resolving npm's `jhipster.cmd` shim on Windows) and `CI=true` (forces non-interactive),
- streams stdout/stderr through an `onData` hook (that's what feeds progress notifications) while buffering for the final result,
- enforces a **timeout** (10 min default) and a **max output buffer** (8 MB), killing the child if either is exceeded,
- turns a missing binary (`ENOENT`) into a clear "install generator-jhipster globally" message.

Every invocation appends `--force --skip-git`. The server never runs `jhipster` interactively. The spawn command and arguments are resolved through `config.ts`: an unpinned setup runs the global `jhipster`, a pinned `JHIPSTER_MCP_GENERATOR_VERSION` dispatches via `npx`, and `JHIPSTER_MCP_DEFAULT_ARGS` are appended here. The sandbox root (`JHIPSTER_MCP_ROOT`) is **not** enforced in this wrapper — it's checked at the user-facing boundary (tool handlers, `applyJdl`, resource `dirOf`) so the isolated preview/export temp dirs, which live outside any root, aren't rejected.

## Applying JDL (`apply.ts`)

JDL-applying tools build their JDL string, then call `applyJdl()`, which branches:

- **Persist (normal):** write the `.jdl` file into the `workingDirectory` and run `jhipster jdl <file> --force --skip-git`.
- **Dry run / validate:** call `runJdlIsolated()` — make a temp dir, copy the project's `.yo-rc.json` + `.jhipster/` in for context, write `preview.jdl`, run `jhipster jdl preview.jdl --force --skip-git --skip-install` **there**, parse the output, and delete the temp dir.

Because JHipster 9's own `--dry-run` still writes files, **isolation is the only honest "no-write" preview** — see [page 7](07-context-management.md#4-dry-run-is-isolation-not-a-flag). A third helper, `exportJdlIsolated()`, backs the `jhipster://project/jdl` resource the same way: it runs `export-jdl` in a temp copy so reading your model never mutates it.

## Parsing into structured output (`result.ts`)

Generator output (much of which arrives on **stderr**) is run through a parser that strips ANSI codes, recognizes Yeoman file-action lines (`create`/`force`/`conflict`/…), extracts entity names from the applied JDL, and collects warnings. The result is validated against a shared zod `outputSchema` and returned as `structuredContent`. The SDK validates that schema **only on success** — so pre-spawn guard failures stay plain `isError` results with no structured payload.

## Input safety (`jdl/builders.ts`)

The agent never hand-concatenates JDL into a shell command. Instead, tools call pure **builder functions** that validate every entity/field/type/package name against strict regexes before assembling the JDL string. `quickLintJdl()` does a fast, spawn-free structural check (empty input, unbalanced braces) so obviously-broken JDL is rejected without starting the generator.

## Resources & prompts

- **Resources** are registered with the SDK's `ResourceTemplate`. The project-state ones take the project directory as a percent-encoded `{?dir}` query variable (resources have no `workingDirectory` arg); the handler decodes it and reads the filesystem (`yo-rc`, `entities`) or runs the isolated export (`jdl`).
- **Prompts** take plain string arguments and return a single `user` message that steers the agent through the right tools — they hold no logic of their own beyond templating.

## Testing & CI (for contributors)

- Tests run on Node's built-in `node:test` via `tsx` — no Jest/Vitest.
- Tools, resources, and prompts are exercised through a **real in-memory MCP client+server pair**, not by calling handlers directly. The `jhipster` CLI is faked by a script on `PATH` that echoes its `{cwd, args}`, so tests are fast and hermetic.
- CI runs typecheck → build → test across Node 20/22/24.

For the full contributor-facing detail, see [CLAUDE.md](../CLAUDE.md) at the repo root.

---

That's the engine. Back to the [docs index](README.md), or see the [ROADMAP](ROADMAP.md) for what's next.
