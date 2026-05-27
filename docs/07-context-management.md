# 7. How the server manages context

← [Prompts](06-prompts.md) · [Docs index](README.md) · Next → [Advanced usage](08-advanced-and-customization.md)

An AI agent only acts well when it has the right information in front of it, and it stays affordable only when that information is *compact*. This server is designed around that: every feature on this page exists to keep the agent **oriented, accurate, and cheap to run**. Understanding them helps you trust what comes back — and prompt better.

## 1. Resources give state cheaply, on demand

Instead of the agent re-deriving your project's shape from old chat history (expensive and error-prone), it can **read the live state** when it needs it:

- `jhipster://docs/jdl-grammar` — the JDL syntax, so generated JDL is correct the first time.
- `jhipster://project/yo-rc{?dir}`, `.../entities{?dir}`, `.../jdl{?dir}` — the project's actual config, entities, and full model.

The agent pulls these **only when relevant**, so they don't bloat the conversation. The practical payoff: it adds fields to an entity by first reading the entity's current definition, so it won't drop or duplicate fields. (Full details on [page 5](05-resources.md).)

## 2. Structured output: JSON the agent reasons over

Every JHipster-running tool returns two things — human text *and* a machine-readable `structuredContent`:

```jsonc
{ "success": true, "exitCode": 0, "dryRun": false,
  "entities": ["Customer", "Order"],
  "filesChanged": [{ "action": "create", "path": "..." }],
  "warnings": ["..."], "command": "jhipster jdl ..." }
```

The agent doesn't re-parse log lines to figure out what happened — it reads the fields. That makes its summaries to you (“created 12 files, 0 conflicts, 1 warning”) reliable rather than a guess. The text is still there for *you* to read; the JSON is for the agent.

## 3. Progress streaming: long runs stay visible

Scaffolds can take 30–90 seconds. Rather than going silent and then dumping everything at the end, the server **streams the generator's output as MCP progress notifications** — one note per output line — while `jhipster` runs, when the host requests progress. You see it working in real time, and the full output still comes back at the end. (Engine details on [page 9](09-how-it-works.md).)

## 4. Dry run is *isolation*, not a flag

This is the most important thing to understand about previews.

**JHipster 9's `--dry-run` does not prevent writes — it only prints conflicts.** (Verified against the real CLI.) So a flag-based preview would still modify your project.

Instead, when you ask for a preview (`dryRun: true`, or any `validate_jdl` call), the server:

1. creates a throwaway temp directory,
2. copies your project's `.yo-rc.json` and `.jhipster/` into it (so the preview reflects your real config + existing entities),
3. runs `jhipster jdl preview.jdl --force --skip-git --skip-install` **there**,
4. parses what was produced, then deletes the temp dir.

Your project directory sees **zero** writes. This is why "preview" here is genuinely safe — you can iterate on JDL with `validate_jdl` and `dryRun` as many times as you like before committing.

## 5. Tool annotations: the host knows what's safe

Each tool carries behavioral **hints** so your host can make smart approval decisions instead of treating every tool as equally risky:

| Hint | Meaning | Tools |
|------|---------|-------|
| `readOnlyHint` | Doesn't modify anything | `info`, `validate_jdl` |
| `destructiveHint` | Can overwrite files (`--force`) | the five applying tools, `generate_ci_cd`, `run_jhipster` |
| `idempotentHint` | Re-running with the same args converges | the applying tools (except `create_app_from_jdl`) |
| `openWorldHint` | May reach external systems | `run_jhipster` (it allows deploy subcommands) |

A host can **auto-approve** the read-only tools (no confirmation prompt) and **gate** the destructive ones. The hints are static, so they describe the **default** behavior — note that an applying tool is flagged destructive even though `dryRun: true` makes that particular call safe; the host gates on the worst case, which is the right default.

## 6. Fail before writing, not halfway through

The server runs cheap guards **before** spawning JHipster:

- `workingDirectory` must be an absolute path that exists.
- `create_app_from_jdl` refuses a non-empty directory.
- `validate_jdl` runs a local lint (empty input, unbalanced braces) with no spawn at all.
- `run_jhipster` checks the subcommand allowlist and arg pattern.

If a guard fails, you get a plain error message and **nothing is generated** — no half-written project to clean up. These pre-flight errors are returned as errors *without* structured output (the structured schema only describes successful generator runs).

## 7. Elicitation: asking instead of guessing

Sometimes the missing context is *yours*, not the project's. When you ask to scaffold an app but the JDL leaves out a key decision — **database, authentication, or client framework** — the server doesn't silently pick a default and generate the wrong app. If your host supports **MCP elicitation**, `create_app_from_jdl` pauses and asks you to choose from a short menu, then injects your answers into the JDL before generating.

- **Accept** → your choices are written into the `application { config { … } }` block.
- **Decline** → it proceeds with JHipster's built-in defaults.
- **Cancel** → nothing is generated.

It only asks for **genuinely missing** keys, only for a **single-application** JDL (microservice topologies are too ambiguous to ask one set of answers), and **never on a dry run**. If your host doesn't support elicitation, the tool behaves exactly as before — defaults apply, no interruption. This turns a one-shot generate into a quick conversation, and saves a multi-minute run that would have produced the wrong thing.

## Putting it together

A typical "add a field to an existing entity" flow shows all of this working:

1. Agent reads `jhipster://project/entities` (resource) to see the current fields.
2. It builds JDL re-declaring the entity with old + new fields, consulting the grammar resource if needed.
3. It calls `import_jdl` with `dryRun: true` — isolated preview, nothing written.
4. It reads the structured result, confirms `success` and the file list, and tells you.
5. On your go-ahead, it runs again with `dryRun: false`; progress streams as it generates.

Each step keeps the agent working from **facts about your project**, not assumptions — which is the whole point.

---

Next: [Advanced usage & customization](08-advanced-and-customization.md).
