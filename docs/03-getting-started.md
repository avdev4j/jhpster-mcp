# 3. Getting started

← [Installation](02-installation.md) · [Docs index](README.md) · Next → [Tools reference](04-tools.md)

This is a guided first session. By the end you'll have scaffolded a real app and know how to read what the server sends back.

## The one rule: always give an absolute path

The server has **no notion of a current directory**. Every tool takes an absolute `workingDirectory`, and the server refuses to act outside it. "The current folder" or a relative path won't resolve. So always tell the agent *where*:

> ✅ "Create an app in `/Users/me/projects/shop` …"
> ❌ "Create an app here …"

## Step 1 — scaffold a new app

Pick an **empty** (or non-existent) directory and ask:

> Create a JHipster monolith in `/Users/me/projects/shop` called `shop`, JWT auth, PostgreSQL in prod with H2 in dev, Angular frontend, Maven, package `com.acme.shop`. Add a `Product` entity (name, price, sku). Paginate everything.

What happens under the hood:

1. The agent may read the **`jhipster://docs/jdl-grammar`** resource to get the JDL syntax right.
2. It builds a single JDL document — an `application { config { … } }` block, the `Product` entity, and `paginate * with pagination`.
3. It calls the **`create_app_from_jdl`** tool, which writes the JDL into the directory and runs `jhipster jdl <file> --force --skip-git`.
4. Output streams back as it's generated; the final result includes a structured summary.

> First scaffolds can take **30–90 seconds**. The server streams generator output as progress notifications while it runs (see [page 7](07-context-management.md)).

## Step 2 — preview before you commit to a change

Before applying a change for real, you can preview it. Every applying tool accepts `dryRun: true`:

> In `/Users/me/projects/shop`, show me what adding a `Tag` entity (name) would change — don't write anything yet.

The agent calls `add_entity` with `dryRun: true`. The server generates into a **throwaway temp copy** of your project, reports what *would* be produced, and discards it. **Your project is not touched.** (Why a temp copy and not `--dry-run`? See [page 7](07-context-management.md) — JHipster's own `--dry-run` still writes files.)

## Step 3 — apply a change

Happy with the preview? Drop the dry run:

> Add that `Tag` entity for real, and a ManyToMany between `Product` and `Tag`.

The agent composes the JDL and runs one generator pass (often a single `import_jdl` call for coordinated changes).

## Step 4 — inspect what you have

> What's the current setup of `/Users/me/projects/shop`? List its entities and DB type.

The agent calls **`info`** (and may read the project-state resources). You get versions, `.yo-rc.json` config, and the entity list.

## How to read the results

Each tool returns two things:

- **Human-readable text** — the generator's output (the `create`/`force`/`conflict` lines you know from the CLI), framed with the exact command that ran and its exit code.
- **Structured JSON** (`structuredContent`) — a machine-readable summary the agent reasons over: `success`, `exitCode`, `entities`, `filesChanged`, `warnings`, `dryRun`, `command`. You don't have to read this, but it's why the agent can reliably tell you "created 12 files, 0 conflicts" without re-parsing logs.

If something goes wrong **before** generation (e.g. the directory isn't empty, or the JDL fails the quick lint), you get a plain error message instead — no half-written project.

## A natural progression to try next

1. Scaffold (above).
2. `validate_jdl` a snippet before applying it.
3. `add_relationship` between two entities.
4. `set_option` to toggle DTOs/pagination/search.
5. `generate_ci_cd` for GitHub Actions.

The [Tools reference](04-tools.md) covers each in detail, and [page 6](06-prompts.md) shows the one-click **prompt** recipes that bundle these steps.

---

Next: [Tools reference](04-tools.md).
