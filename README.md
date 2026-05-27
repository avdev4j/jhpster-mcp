# jhipster-mcp

A Model Context Protocol (MCP) server that lets AI agents — Claude Code, Claude Desktop, Cursor, or any MCP-compatible host — drive the [JHipster](https://github.com/jhipster/generator-jhipster) CLI to scaffold and evolve applications using **JDL** (JHipster Domain Language).

You describe the app or change you want; the agent translates it to JDL, validates it, and runs JHipster — while this server keeps every run **non-interactive, sandboxed to a directory you name, and safe to preview before it writes**.

## 📖 Documentation

**Full user guide → [`docs/`](docs/README.md).** If you know JHipster but are new to MCP, start there and read in order:

1. [Introduction](docs/01-introduction.md) — what an MCP server is, and the tools / resources / prompts model.
2. [Installation](docs/02-installation.md) — connect it to your host.
3. [Getting started](docs/03-getting-started.md) — your first guided session.
4. [Tools reference](docs/04-tools.md) · 5. [Resources](docs/05-resources.md) · 6. [Prompts](docs/06-prompts.md)
7. [How the server manages context](docs/07-context-management.md)
8. [Advanced usage & customization](docs/08-advanced-and-customization.md)
9. [How it works (engine)](docs/09-how-it-works.md)

Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start

**Prerequisites:** Node.js 20+ and a working global `jhipster` CLI on your `PATH` (`npm install -g generator-jhipster`). The server spawns your existing `jhipster` binary — it does not bundle the generator. Full details in [Installation](docs/02-installation.md).

### Claude Code

```bash
claude mcp add jhipster -- npx -y jhipster-mcp
```

### Claude Desktop / Cursor / other hosts

Add this to your host's MCP config (e.g. `claude_desktop_config.json`), then restart:

```json
{
  "mcpServers": {
    "jhipster": {
      "command": "npx",
      "args": ["-y", "jhipster-mcp"]
    }
  }
}
```

Then ask your host something like *"Create a JHipster monolith in `/tmp/demo` with a `Product` entity."* See [Getting started](docs/03-getting-started.md) for a full walkthrough and more examples.

## What's inside (at a glance)

- **13 tools** — `validate_jdl`, `create_app_from_jdl`, `import_jdl`, `add_entity`, `add_relationship`, `set_option`, `info`, `project_commands`, `upgrade_advisor`, `preview_upgrade`, `generate_ci_cd`, `generate_deployment`, `run_jhipster`. ([reference](docs/04-tools.md))
- **Resources** — the JDL grammar plus live project state (`yo-rc`, `entities`, exported `jdl`). ([reference](docs/05-resources.md))
- **Prompts** — `scaffold_crud_monolith`, `add_audit_fields`, `monolith_to_microservices`. ([reference](docs/06-prompts.md))
- **Safe by design** — directory scoping, empty-dir guard, no shell, JDL-injection guards, and isolated preview/`dryRun`. ([details](docs/07-context-management.md))

## Development

```bash
npm run dev         # tsup --watch
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/index.js
npm test            # node --test + tsx
npm run test:watch  # tests in watch mode
```

CI runs typecheck, build, and tests on every push/PR to `main` via [.github/workflows/ci.yml](.github/workflows/ci.yml) across Node 20/22/24 on Ubuntu and macOS. Architecture and conventions for contributors live in [CLAUDE.md](CLAUDE.md); the engine is also documented for users in [docs/09-how-it-works.md](docs/09-how-it-works.md).

Quick smoke test (lists tools over stdio):

```bash
(cat <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
EOF
) | node dist/index.js
```

## Releasing

**The GitHub Release tag is the single source of truth for the version.** Everything derives from it:

- The release workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) reads the tag (e.g. `v0.0.3`), strips the `v`, and sets `package.json` to that version before building and publishing.
- The MCP server reports `pkg.version` at runtime ([src/index.ts](src/index.ts) imports `package.json`, inlined at build) — so the published npm version, the tag, and the runtime version are always identical.

To cut a release:

1. On GitHub, go to **Releases → Draft a new release**.
2. Create a new tag named **`vX.Y.Z`** (semver, `v`-prefixed) targeting `main`, fill in the notes, and **Publish release**.

Publishing the release fires the `release: published` event, which triggers the workflow to:
1. check out the release tag and set `package.json` to `X.Y.Z`,
2. run build + test,
3. publish to npm via **Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret; provenance is generated automatically (requires the Trusted Publisher to be configured on npmjs.com for this repo + workflow, and npm ≥ 11.5.1, which the workflow installs).

You don't need to bump `package.json` in a commit beforehand — the workflow forces it to match the tag. (Optionally keep `main`'s `package.json` in step with `npm version --no-git-tag-version X.Y.Z` so local dev reports the right version, but it isn't required for publishing.)

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
