# 1. Introduction

← [Docs index](README.md) · Next → [Installation](02-installation.md)

## What problem does this solve?

You already know how to scaffold and evolve apps with JHipster: write JDL, run `jhipster jdl app.jdl`, answer the prompts, repeat. **jhipster-mcp** lets you do all of that by *describing what you want to an AI agent* instead of writing the JDL and running the CLI yourself.

You say:

> "Create a monolith in `/tmp/shop` with a `Product` entity (name, price) and paginate everything."

The agent writes the JDL, validates it, and runs JHipster for you — then tells you what changed.

## What is an MCP server (in JHipster terms)?

**MCP** (Model Context Protocol) is a standard way for an AI host — Claude Code, Claude Desktop, Cursor, etc. — to talk to an external program that exposes *capabilities*. jhipster-mcp is that external program. Think of it as a **thin, safe adapter between the agent and your global `jhipster` binary**.

It does **not** bundle JHipster. It spawns the same `jhipster` you installed with `npm install -g generator-jhipster`. So the generator version, blueprints, and behavior are exactly what you'd get on the command line — the server just calls it for the agent, non-interactively, inside a directory you specify.

```
You ──▶ AI host (Claude Code / Desktop / Cursor)
            │   speaks MCP
            ▼
        jhipster-mcp  ──spawns──▶  your global `jhipster` CLI  ──▶  your project files
```

## The mental model: tools, resources, prompts

MCP servers expose three kinds of things. Knowing which is which is the whole mental model:

| Kind | Who triggers it | Analogy | Examples here |
|------|-----------------|---------|---------------|
| **Tool** | The **agent** calls it to *do* something | A CLI subcommand | `create_app_from_jdl`, `add_entity`, `info` |
| **Resource** | Read on demand to *learn* something (no side effects) | A file the agent can open | the JDL grammar; your project's `.yo-rc.json`, entities, exported JDL |
| **Prompt** | **You** pick it to *start* a workflow | A slash command / saved recipe | `scaffold_crud_monolith`, `add_audit_fields`, `monolith_to_microservices` |

- **Tools** are the verbs. The agent decides which to call based on what you asked.
- **Resources** are reference data the agent can pull cheaply — so it reads your actual project state instead of guessing.
- **Prompts** are pre-written recipes *you* invoke (your host usually surfaces them as slash commands), which then steer the agent through the right tools.

You'll meet each in its own reference page. Page [7](07-context-management.md) explains how they fit together to keep the agent oriented.

## What this server covers

- **Scaffold a new app** from JDL (`create_app_from_jdl`).
- **Evolve an existing project** — add entities, relationships, options, or apply raw JDL (`add_entity`, `add_relationship`, `set_option`, `import_jdl`).
- **Validate and preview** before writing a single file (`validate_jdl`, plus a `dryRun` flag on every applying tool).
- **Inspect** a project (`info`) and read its live state (resources).
- **Generate CI/CD** config (`generate_ci_cd`).
- **Escape hatch** for allowlisted subcommands not covered by a dedicated tool (`run_jhipster`).
- **Guided recipes** as prompts (CRUD monolith, audit fields, monolith→microservices).

## What it deliberately does *not* do

This server's job ends where the generator's does. It will **not**:

- run `mvn` / `npm` builds,
- start the generated app or run its tests,
- touch git (commits, pushes),
- run `jhipster` interactively (it's always `--force --skip-git`, `CI=true`).

Use your host's own shell tooling for builds, runs, and git. This boundary is intentional — it keeps the server predictable and safe to grant access to.

---

Next: [Installation](02-installation.md) — get it connected to your host.
