# jhipster-mcp documentation

Welcome. This is the full user guide for **jhipster-mcp** — an MCP server that lets an AI agent drive the JHipster CLI for you, through JDL.

These docs assume you **know JHipster and JDL** but have **never used an MCP server**. Read them in order the first time; each page builds on the last. After that, use it as a reference.

## Reading path

| # | Page | What you'll get |
|---|------|-----------------|
| 1 | [Introduction](01-introduction.md) | What an MCP server is (in JHipster terms), the mental model — *tools / resources / prompts* — and what this server does and deliberately does **not** do. |
| 2 | [Installation](02-installation.md) | Prerequisites and how to connect the server to Claude Code, Claude Desktop, Cursor, or any MCP host. |
| 3 | [Getting started](03-getting-started.md) | Your first guided session: scaffold an app and read what comes back. |
| 4 | [Tools reference](04-tools.md) | Every tool, its arguments, and when the agent reaches for it. |
| 5 | [Resources reference](05-resources.md) | The read-only data the agent can pull — JDL grammar and live project state. |
| 6 | [Prompts (slash commands)](06-prompts.md) | Ready-made, parameterized workflows you trigger yourself. |
| 7 | [How the server manages context](07-context-management.md) | Structured output, progress streaming, dry-run isolation, and tool hints — why the agent stays oriented and cheap to run. |
| 8 | [Advanced usage & customization](08-advanced-and-customization.md) | Tailor it to your workflow: extra flags, the escape hatch, version pinning, prompting tips, safety controls. |
| 9 | [How it works (engine)](09-how-it-works.md) | The architecture under the hood — spawn wrapper, isolation, injection guards. |

## Reference

- [ROADMAP.md](ROADMAP.md) — what's built and what's coming. These docs evolve alongside it.

## In one sentence

You describe the application or change you want in plain language; the agent translates it to JDL, validates it, and runs JHipster — while this server keeps the run **non-interactive, sandboxed to a directory you name, and safe to preview before it writes**.
