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

## Quick start (from npm)

The package is published on npm: **[jhipster-mcp](https://www.npmjs.com/package/jhipster-mcp)**. You don't need to clone or build anything — your MCP host runs it via `npx`, which downloads and caches it automatically.

### Claude Code

```bash
claude mcp add jhipster -- npx -y jhipster-mcp
```

Or add it to your MCP config (e.g. `~/.claude/mcp.json`) manually:

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

Add the same block to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then restart the app.

### Cursor / other MCP hosts

Use the same `command` / `args` pair in whatever MCP config your host exposes.

> Tip: to pin a version, use `npx -y jhipster-mcp@0.0.2`. To install once globally instead of resolving via `npx` each launch: `npm install -g jhipster-mcp` and set `"command": "jhipster-mcp"` with no `args`.

After adding it, restart your host and ask it something like *"Create a JHipster monolith in /tmp/demo with a Product entity."* — see [Example prompts to try](#example-prompts-to-try).

## Install from source (development)

Only needed if you want to hack on the server itself:

```bash
git clone https://github.com/avdev4j/jhipster-mcp.git
cd jhipster-mcp
npm install
npm run build
```

The built entry point lands at `dist/index.js` (marked executable). Point your MCP host at your local build:

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

## Tools

All tools accept an absolute `workingDirectory`. Every JHipster invocation runs with `--force --skip-git` to stay non-interactive.

| Tool | What it does |
|---|---|
| `validate_jdl` | Validates JDL **without writing files** — fast local lint (empty/unbalanced braces) then a `jhipster jdl --dry-run` parse. Catches errors before a real generation. |
| `create_app_from_jdl` | Writes the JDL into an **empty** dir and runs `jhipster jdl <file>` to scaffold a new app. |
| `import_jdl` | Writes JDL into an existing project and applies it. |
| `add_entity` | Builds JDL for one entity + optional per-entity options, then applies it. |
| `add_relationship` | Builds a `relationship <kind> { A{a} to B{b} }` block and applies it. |
| `set_option` | Applies a JDL option line (e.g. `paginate * with pagination`). |
| `info` | Runs `jhipster info`. |
| `generate_ci_cd` | Runs `jhipster ci-cd --ci-cd=<provider>` for jenkins / github / gitlab / azure / travis / circle. |
| `run_jhipster` | Escape hatch — runs an allowlisted subcommand with sanitized args. |

Every JDL-applying tool (`create_app_from_jdl`, `import_jdl`, `add_entity`, `add_relationship`, `set_option`) accepts **`dryRun: true`** for a true no-write preview. (JHipster's own `--dry-run` only prints conflicts — it still writes — so this server instead generates in a throwaway temp dir, copying the project's `.yo-rc.json`/`.jhipster` for context, parses what would be produced, and discards it. Your project is never modified.)

### Structured output

Every tool that runs `jhipster` declares an `outputSchema` and returns machine-readable `structuredContent` alongside the human-readable text, so agents can reason on JSON instead of parsing logs:

```jsonc
{
  "command": "jhipster jdl changes.jdl --force --skip-git",
  "exitCode": 0,
  "success": true,
  "dryRun": false,
  "entities": ["Customer", "Order"],          // parsed from the applied JDL
  "filesChanged": [{ "action": "create", "path": "src/main/java/..." }],
  "warnings": ["WARNING! ..."]
}
```

(Pre-flight guard failures — allowlist, non-empty dir, lint errors — return an `isError` text result without `structuredContent`.)

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

## Example prompts to try

Once the server is connected to your MCP host, paste any of these into the chat to exercise different tools. Each example shows the **intent → which tool the agent will fire → what to expect**. Replace the absolute paths with paths on your machine.

### 1. Scaffold a brand-new app from scratch

> Create a JHipster monolith in `/Users/me/projects/shop` called `shop`, JWT auth, PostgreSQL in prod with H2 in dev, Angular frontend, Maven, package `com.acme.shop`. Add a `Product` entity (name, price, sku) and a `Category` entity (name) with a OneToMany from Category to Products. Paginate everything.

→ `create_app_from_jdl` with a full JDL block (`application { config { … } }`, both entities, the relationship, and `paginate * with pagination`).

### 2. Microservice topology

> Scaffold a JHipster microservices setup in `/tmp/banking`: a `gateway` app, an `accounts` microservice on port 8081, and a `payments` microservice on port 8082. All Postgres, JWT, Maven, package `com.acme.banking.<service>`. `accounts` owns `Account(iban, balance)`, `payments` owns `Payment(amount, status)` with an enum `PaymentStatus { PENDING, SETTLED, FAILED }`.

→ `create_app_from_jdl` with three `application { … }` blocks plus the entities and enum.

### 3. Add an entity to an existing project

> In `/Users/me/projects/shop`, add a `Customer` entity with firstName (required, 2–50 chars), lastName (required), email (required, email-ish regex), and birthDate.

→ `add_entity` — the server builds the JDL snippet, writes `entity-Customer.jdl`, runs `jhipster jdl entity-Customer.jdl --force --skip-git`.

### 4. Add a relationship

> Add a OneToMany from `Customer.orders` to `Order.customer`, with the customer side required.

→ `add_relationship` with `kind=OneToMany, from={entity:Customer, field:orders}, to={entity:Order, field:customer, required:true}`.

### 5. Toggle per-entity options

> In `/Users/me/projects/shop`, enable MapStruct DTOs and service classes for every entity except `Country`, and put Elasticsearch search on `Product` and `Order`.

→ `set_option` three times (or one `import_jdl`):

```jdl
dto * with mapstruct except Country
service * with serviceClass except Country
search Product, Order with elasticsearch
```

### 6. Bulk changes via raw JDL

> Apply this JDL to `/Users/me/projects/shop`:
> ```jdl
> entity Review { rating Integer required min(1) max(5), comment TextBlob }
> relationship ManyToOne { Review{product required} to Product }
> paginate Review with infinite-scroll
> ```

→ `import_jdl` — the most flexible path; useful when several changes go together.

### 7a. Validate JDL before applying

> Validate this JDL without changing anything:
> ```jdl
> entity Invoice { number String required, total BigDecimal min(0) }
> ```

→ `validate_jdl` — local lint, then generate in an isolated throwaway dir and discard. Add `workingDirectory` to validate entity-only JDL against an existing project's model (its config/entities are copied into the temp dir; your project is untouched).

### 7b. Preview a change (dry run)

> In `/Users/me/projects/shop`, show me what adding a `Tag` entity would change — don't write anything yet.

→ `add_entity` with `dryRun: true` (works on all JDL-applying tools).

### 7. Generate CI/CD config

> Add a GitHub Actions pipeline to `/Users/me/projects/shop`.

→ `generate_ci_cd` with `pipeline=github`.

### 8. Inspect a project

> What's the current setup of the project at `/Users/me/projects/shop`? List its entities and DB type.

→ `info` — returns versions, `.yo-rc.json` config, and entity list.

### 9. Escape hatch — uncommon subcommand

> Run `jhipster export-jdl` in `/Users/me/projects/shop` to dump the current model to `current.jdl`.

→ `run_jhipster` with `subcommand=export-jdl, args=["current.jdl"]` (allowlisted, no shell metacharacters).

### 10. Multi-step refactor (the agent chains tools on its own)

> In `/Users/me/projects/shop`, I want a proper order workflow. Add an `OrderStatus` enum (DRAFT, PLACED, PAID, SHIPPED, CANCELLED), give `Order` a `status` field using it, and a `placedAt Instant` field. Also add a OneToMany from `Order` to a new `OrderLine` (qty, unitPrice) entity. Make sure everything paginates and `Order` is filterable.

→ The agent composes a single JDL snippet and calls `import_jdl` — one generator run for the whole change.

### Prompting tips

- **Always give an absolute path.** All tools require `workingDirectory`; "the current folder" won't resolve.
- **Be specific about field types and validations** (e.g. `price BigDecimal required min(0)`) to save a round-trip to the grammar resource.
- **For new apps, empty the target dir first.** `create_app_from_jdl` refuses to write into a non-empty directory.
- **Prefer one big `import_jdl` over many granular calls** for coordinated changes — one generator run instead of N.
- **Long generations:** initial scaffolds can take 30–90 s. The server streams generator output as MCP progress notifications (one per output line) when the host requests progress, and also returns the full output at the end.
- **Out of scope:** this MCP won't run `mvn` / `npm` builds, start the app, run tests, or push to git. Use your host's shell tool for that.

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
npm test            # node --test + tsx
npm run test:watch  # tests in watch mode
```

CI runs typecheck, build, and tests on every push/PR to `main` via [.github/workflows/ci.yml](.github/workflows/ci.yml) across Node 20/22/24 on Ubuntu and macOS.

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
