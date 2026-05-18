# jhipster-mcp

A Model Context Protocol (MCP) server that lets AI agents — Claude Code, Claude Desktop, Cursor, or any MCP-compatible host — drive the [JHipster](https://github.com/jhipster/generator-jhipster) CLI to scaffold and evolve applications using **JDL** (JHipster Domain Language).

## Prerequisites

- Node.js **20+**
- A working global `jhipster` CLI on `PATH`:
  ```bash
  npm install -g generator-jhipster
  jhipster --version
  ```
- Java, Maven/Gradle, etc. — whatever the generated project itself needs.

The MCP server spawns your existing global `jhipster` binary; it does **not** bundle the generator.

## Install

From source (until published):

```bash
git clone <this-repo> jhipster-mcp
cd jhipster-mcp
npm install
npm run build
```

The built entry point lands at `dist/index.js` and is marked executable.

## Configure your MCP host

### Claude Code

Add to your MCP config (e.g. `~/.claude/mcp.json` or via `claude mcp add`):

```json
{
  "mcpServers": {
    "jhipster": {
      "command": "node",
      "args": ["/absolute/path/to/jhipster-mcp/dist/index.js"]
    }
  }
}
```

Or, once published to npm:

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

### Claude Desktop

Same shape, in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS).

## Tools

All tools accept an absolute `workingDirectory`. Every JHipster invocation runs with `--force --skip-git` to stay non-interactive.

| Tool | What it does |
|---|---|
| `create_app_from_jdl` | Writes the JDL into an **empty** dir and runs `jhipster jdl <file>` to scaffold a new app. |
| `import_jdl` | Writes JDL into an existing project and applies it. |
| `add_entity` | Builds JDL for one entity + optional per-entity options, then applies it. |
| `add_relationship` | Builds a `relationship <kind> { A{a} to B{b} }` block and applies it. |
| `set_option` | Applies a JDL option line (e.g. `paginate * with pagination`). |
| `info` | Runs `jhipster info`. |
| `generate_ci_cd` | Runs `jhipster ci-cd --ci-cd=<provider>` for jenkins / github / gitlab / azure / travis / circle. |
| `run_jhipster` | Escape hatch — runs an allowlisted subcommand with sanitized args. |

## Resources

| URI | Description |
|---|---|
| `jhipster://docs/jdl-grammar` | Embedded JDL cheat-sheet (Markdown) for the LLM to consult before writing JDL. |

For project state (e.g. `.yo-rc.json`, generated entity JSON files), use your host's file-reading tool or call the `info` tool.

## Example session

> *"Create a JHipster monolith in `/tmp/shop` with Postgres + Angular and one `Product` entity with name and price."*

The agent will typically:
1. Read the `jhipster://docs/jdl-grammar` resource.
2. Call `create_app_from_jdl` with JDL like:
   ```jdl
   application {
     config {
       baseName shop
       applicationType monolith
       authenticationType jwt
       databaseType sql
       prodDatabaseType postgresql
       devDatabaseType h2Disk
       clientFramework angular
       buildTool maven
       packageName com.example.shop
     }
     entities Product
   }
   entity Product {
     name String required maxlength(100)
     price BigDecimal required min(0)
   }
   paginate * with pagination
   service * with serviceClass
   ```
3. Stream back the generator output.

To later add a relationship the agent might call `add_relationship` with `kind=OneToMany, from={entity:Customer, field:orders}, to={entity:Order, field:customer, required:true}`.

## Safety notes

- All tools take an explicit `workingDirectory` — the server refuses to act outside it.
- `create_app_from_jdl` refuses to overwrite a non-empty directory (`.git` and `.DS_Store` are ignored).
- `run_jhipster` validates the subcommand against an allowlist and rejects args containing shell metacharacters; it does **not** invoke a shell (`spawn` with `shell: false`).
- JDL builders validate entity/field/type names against strict regex to prevent JDL injection.

## Development

```bash
npm run dev         # tsup --watch
npm run typecheck   # tsc --noEmit
npm run build       # tsup → dist/index.js
```

Quick smoke test (lists tools over stdio):

```bash
(cat <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
EOF
) | node dist/index.js
```

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
