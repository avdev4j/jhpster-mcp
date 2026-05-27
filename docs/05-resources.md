# 5. Resources reference

← [Tools](04-tools.md) · [Docs index](README.md) · Next → [Prompts](06-prompts.md)

Resources are **read-only data** the agent can pull on demand — no side effects, nothing generated. They let the agent *learn* (the JDL grammar, or your project's actual state) instead of guessing. That keeps changes accurate and reduces destructive edits.

## The JDL grammar cheat-sheet

| URI | Content |
|-----|---------|
| `jhipster://docs/jdl-grammar` | A concise Markdown reference for JDL: application config, entities, field types, validations, enums, relationships, and options. |

The agent reads this before writing JDL so it gets the syntax right without a round-trip. You rarely reference it directly, but you can ask the agent to "check the JDL grammar resource" if it's getting syntax wrong.

## Project-state resources

These expose the **live state** of a generated project, so the agent can inspect what already exists before mutating it. Each is keyed to a project directory via a **`{?dir}` query variable** — the directory rides in the URI because resources have no `workingDirectory` argument the way tools do.

| URI template | Returns |
|--------------|---------|
| `jhipster://project/yo-rc{?dir}` | The app's `.yo-rc.json` (type, database, auth, client, package). |
| `jhipster://project/entities{?dir}` | Every `.jhipster/*.json` entity config, aggregated into one JSON object keyed by entity name. |
| `jhipster://project/jdl{?dir}` | The whole project as a single JDL document, synthesized via `jhipster export-jdl`. |

`dir` is an **absolute, URL-encoded** path. For example, to read the entities of a project at `/Users/me/projects/shop`:

```
jhipster://project/entities?dir=%2FUsers%2Fme%2Fprojects%2Fshop
```

(Your host and the agent build these URIs for you; you don't normally type them.)

### How they behave

- **`yo-rc`** and **`entities`** are pure filesystem reads — fast, no CLI involved. If the project isn't a JHipster app (no `.yo-rc.json` / `.jhipster`), you get a friendly note or an empty `{ "entities": {} }` rather than an error.
- **`jdl`** runs `jhipster export-jdl` — but in an **isolated temp copy** of the project, so reading it **never writes to your project**. It's the heaviest of the three (it spawns the CLI), so the agent uses it when it needs the full model at once — e.g. before a monolith→microservices split.

### Why this matters

Before these resources existed, an agent evolving a project had to infer its state from earlier output or risk overwriting things. Now it can open `entities` to see which fields already exist (so it won't duplicate them), or open `jdl` for a single-document view before a big refactor. This is the backbone of how the server keeps the agent oriented — see [page 7](07-context-management.md).

---

Next: [Prompts](06-prompts.md) — the recipes *you* trigger.
