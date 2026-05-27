# 6. Prompts (slash commands)

← [Resources](05-resources.md) · [Docs index](README.md) · Next → [Context management](07-context-management.md)

Prompts are **recipes you trigger** — not the agent. Where tools are verbs the agent picks, a prompt is a saved, parameterized workflow that *you* start, and most hosts surface them as **slash commands**. Pick one, fill in a couple of arguments, and the server hands the agent a ready-made instruction that drives the right tools in the right order (always preview-first).

They exist so you don't have to remember the exact JDL or tool sequence for common jobs — the best-practice path is baked in.

## How to use a prompt

In a host that supports MCP prompts (e.g. Claude Code), they appear as slash commands or in a prompt picker. You choose one and supply its arguments; the server returns the instruction message and the agent runs it. (If your host doesn't surface prompts, you can always achieve the same thing by describing the task in plain language — the prompts just save you the typing and encode the good defaults.)

Arguments are plain strings.

## The three prompts

### `scaffold_crud_monolith` — Scaffold a CRUD monolith

Generate a complete monolith with full CRUD (pagination + service layer + DTOs) for the entities you name.

| Argument | Required | Notes |
|----------|:---:|-------|
| `workingDirectory` | ✅ | Empty/non-existent dir to scaffold into. |
| `baseName` | ✅ | App name, e.g. `bookstore`. |
| `entities` | ✅ | A comma-separated list (`Book, Author, Order`) **or** a plain-English domain description — the agent turns it into well-typed JDL. |
| `database` | | `postgresql` (default) / `mysql` / `mariadb` / `mssql` / `oracle` / `mongodb`. |
| `auth` | | `jwt` (default) / `oauth2` / `session`. |
| `client` | | `angular` (default) / `react` / `vue` / `no`. |
| `packageName` | | e.g. `com.example.bookstore`. |

It builds the `application` block with your config, appends `paginate * with pagination`, `service * with serviceClass`, `dto * with mapstruct`, and calls `create_app_from_jdl` (dry-run first).

### `add_audit_fields` — Add audit fields to entities

Add the four standard Spring Data auditing fields — `createdBy`, `createdDate`, `lastModifiedBy`, `lastModifiedDate` — to existing entities.

| Argument | Required | Notes |
|----------|:---:|-------|
| `workingDirectory` | ✅ | The existing project. |
| `entities` | | Comma-separated names to audit; omit for **every** entity. |

It first reads the `jhipster://project/entities` resource (to skip entities that already have the fields and to re-emit each entity's full definition), then applies the change via `import_jdl`.

> These mirror JHipster's auditing columns; **populating** them at runtime is your application's concern (Spring Data auditing), not the generator's.

### `monolith_to_microservices` — Plan a monolith → microservices split

Turn an existing monolith's model into a gateway + microservice JDL, assigning entities to services.

| Argument | Required | Notes |
|----------|:---:|-------|
| `workingDirectory` | ✅ | The existing monolith (source of truth). |
| `targetDirectory` | ✅ | Empty dir to generate the microservices JDL into. |
| `services` | ✅ | The split, e.g. `orders: Order, OrderItem; catalog: Product, Category`. Unlisted entities stay on the gateway. |
| `gatewayName` | | Gateway app name (default `gateway`). |

It reads the `jhipster://project/jdl` resource for the current model, designs one `application` block per service plus a gateway, **flags relationships that would cross service boundaries**, carries over CRUD options, validates with `validate_jdl`, then generates.

## Prompts vs. just asking

Everything a prompt does, you can also get by describing the task in chat. The difference: a prompt is **repeatable, parameterized, and opinionated** (good defaults, preview-first, reads state before mutating). Use prompts for the common jobs; use free-form chat for one-offs and anything the prompts don't cover.

---

Next: [How the server manages context](07-context-management.md).
