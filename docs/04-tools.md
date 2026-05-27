# 4. Tools reference

← [Getting started](03-getting-started.md) · [Docs index](README.md) · Next → [Resources](05-resources.md)

Tools are the **verbs** — the agent calls them to do work. You don't call tools directly; you describe intent and the agent picks the tool. This page is so you understand (and can steer) those choices.

**Two rules apply to every tool:**

1. Every tool takes an absolute **`workingDirectory`** (the server has no cwd).
2. Every JHipster invocation runs **non-interactively** (`--force --skip-git`, `CI=true`).

## The twelve tools

| Tool | What it does | Read-only? |
|------|--------------|:---:|
| [`validate_jdl`](#validate_jdl) | Validate JDL without writing any files. | ✅ |
| [`info`](#info) | Run `jhipster info` — versions, config, entities. | ✅ |
| [`project_commands`](#project_commands) | Report build/run/test commands (runs nothing). | ✅ |
| [`upgrade_advisor`](#upgrade_advisor) | Pre-flight advice for a version upgrade (runs nothing). | ✅ |
| [`create_app_from_jdl`](#create_app_from_jdl) | Scaffold a **new** app from JDL into an empty dir. | |
| [`import_jdl`](#import_jdl) | Apply raw JDL to an **existing** project. | |
| [`add_entity`](#add_entity) | Build + apply JDL for one entity. | |
| [`add_relationship`](#add_relationship) | Build + apply one relationship. | |
| [`set_option`](#set_option) | Apply a JDL option line (paginate/dto/service/…). | |
| [`generate_ci_cd`](#generate_ci_cd) | Scaffold a CI/CD pipeline. | |
| [`generate_deployment`](#generate_deployment) | Scaffold a docker-compose / kubernetes deployment. | |
| [`run_jhipster`](#run_jhipster) | Escape hatch for allowlisted subcommands. | |

The five JDL-applying tools (`create_app_from_jdl`, `import_jdl`, `add_entity`, `add_relationship`, `set_option`) all accept **`dryRun: true`** — see [Dry run](#dry-run-preview-without-writing).

---

### `validate_jdl`

Checks JDL for errors **without modifying any project**. Runs a fast local structural lint (empty input, unbalanced braces) first, then generates from the JDL in an isolated throwaway directory and discards it — so syntax/semantic errors surface before a real run.

| Arg | Required | Notes |
|-----|:---:|-------|
| `jdl` | ✅ | The JDL source to validate. |
| `workingDirectory` | | An existing project to validate *against* (its config/entities are copied into the temp dir, so entity-only JDL that references existing entities resolves). Omit for full JDL with its own `application { … }` block. |

### `info`

Runs `jhipster info` to print versions, configuration, entities, and environment. Read-only.

| Arg | Required |
|-----|:---:|
| `workingDirectory` | ✅ |

### `project_commands`

Inspects a generated project and **reports** the commands to build, run, test, package, and dockerize it — without running any of them. Read-only; pure filesystem reads.

| Arg | Required |
|-----|:---:|
| `workingDirectory` | ✅ |

Returns `{ buildTool, clientFramework, commands: [{ category, command, description }], notes }`. Commands are grounded in the actual project: it prefers the `./mvnw`/`./gradlew` wrapper when present and only lists `npm run …` scripts that exist in `package.json`. This is the in-scope counterpart to the things the server won't do — see [Introduction → out of scope](01-introduction.md#what-it-deliberately-does-not-do).

### `upgrade_advisor`

Read-only pre-flight for moving a project to a newer JHipster version. Reads `.yo-rc.json` (current version, app type, blueprints) and the entity count, compares against a target you name, and reports the bump type, a risk rating, project-specific considerations, a recommended upgrade checklist, and official references. It **runs nothing** and does **not** enumerate version-specific breaking changes — that's for the agent/release notes to fill in.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | An existing JHipster project. |
| `targetVersion` | | The version you want to upgrade to (e.g. `8.7.4`). Omit to just report current state + generic guidance. |

Returns `{ currentVersion, targetVersion, bump, riskLevel, applicationType, blueprints, entityCount, considerations, steps, references }`. Risk rises with a major bump, blueprints, a microservices topology, and a large entity count. This is the first of the Tier 5 upgrade features on the [roadmap](ROADMAP.md).

### `create_app_from_jdl`

Scaffolds a **new** application: writes the JDL into the target directory and runs `jhipster jdl <file>`. The directory must be **empty** (`.git` / `.DS_Store` ignored) — it refuses to overwrite a populated dir.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | Empty or non-existent dir; created if missing. |
| `jdl` | ✅ | Full JDL with at least one `application { config { … } }` block. |
| `jdlFilename` | | Defaults to `app.jdl`. |
| `dryRun` | | Preview without writing. |
| `blueprints` | | Generator blueprints, e.g. `["kotlin"]` → `--blueprints kotlin`. Must be installed where jhipster runs. See [Advanced → Blueprints](08-advanced-and-customization.md#blueprints). |
| `extraArgs` | | Extra flags forwarded to `jhipster jdl` (e.g. `["--skip-install"]`). |

> **Asks before defaulting:** if your JDL's single `application` block omits the database, authentication, or client framework, and your host supports MCP elicitation, the tool will ask you to choose (rather than silently defaulting) before it generates. Decline to accept JHipster's defaults, or cancel to abort. Skipped on a dry run and when the JDL already sets them. See [page 7](07-context-management.md#7-elicitation-asking-instead-of-guessing).

### `import_jdl`

Applies arbitrary JDL to an **existing** project (entities, relationships, options). The most flexible path — prefer it when several changes go together (one generator run instead of many).

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | An existing project. |
| `jdl` | ✅ | JDL to apply. |
| `jdlFilename` | | Defaults to `changes.jdl`. |
| `dryRun` | | Preview without writing. |
| `backup` | | Snapshot the project before applying (see [Safe-apply](#safe-apply-backup--rollback)). |
| `blueprints` | | Generator blueprints → `--blueprints`. Usually unnecessary after the app was created with them. See [Advanced → Blueprints](08-advanced-and-customization.md#blueprints). |
| `extraArgs` | | Extra flags forwarded to `jhipster jdl`. |

### `add_entity`

Builds the JDL for **one** entity (with optional per-entity options) and applies it. Convenient for single, well-specified additions.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | |
| `name` | ✅ | PascalCase entity name. |
| `fields` | | Array of `{ name, type, validations? }`. |
| `options` | | Per-entity options, e.g. `{ paginate: "pagination", service: "serviceClass" }`. |
| `dryRun` | | Preview without writing. |

### `add_relationship`

Builds a `relationship <kind> { A{a} to B{b} }` block and applies it.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | |
| `kind` | ✅ | `OneToOne` / `OneToMany` / `ManyToOne` / `ManyToMany`. |
| `from` | ✅ | Owning side: `{ entity, field, required? }`. |
| `to` | ✅ | Target side: `{ entity, field?, required? }` (field optional = no back-reference). |
| `dryRun` | | Preview without writing. |

### `set_option`

Applies a JDL option line such as `paginate * with pagination`.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | |
| `option` | ✅ | e.g. `paginate`, `service`, `dto`, `search`, `readOnly`, `filter`. |
| `value` | | e.g. `pagination`, `serviceClass`, `mapstruct`, `elasticsearch`. Omit for boolean-style options. |
| `entities` | | Entities to apply to; `["*"]` or omit for all. |
| `except` | | Entities to exclude when applying to all. |
| `dryRun` | | Preview without writing. |

### `generate_ci_cd`

Runs `jhipster ci-cd --ci-cd=<provider>`.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | |
| `pipeline` | ✅ | `jenkins` / `github` / `gitlab` / `azure` / `travis` / `circle`. |
| `extraArgs` | | Extra flags forwarded to `jhipster ci-cd`. |

### `generate_deployment`

Builds a declarative JDL `deployment { … }` block and applies it with `jhipster jdl` — the non-interactive way to scaffold a docker-compose or kubernetes deployment for one or more already-generated apps.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | Deployment directory (created if missing); JHipster resolves `appsFolders` relative to it. |
| `deploymentType` | ✅ | `docker-compose` or `kubernetes`. |
| `appsFolders` | ✅ | App folder names to include, e.g. `["store", "invoice"]`. |
| `dockerRepositoryName` | | Docker registry/repository prefix for images. |
| `monitoring` | | `no` / `prometheus`. |
| `serviceDiscoveryType` | | `eureka` / `consul` / `no`. |
| `kubernetesNamespace`, `kubernetesServiceType`, `ingressDomain`, `istio` | | Kubernetes-only options. |
| `extraArgs` | | Extra flags forwarded to `jhipster jdl`. |

The named apps must already be generated JHipster apps that JHipster can find relative to `workingDirectory` (typically the deployment dir sits alongside them). There's no `dryRun` here — an isolated preview wouldn't have the sibling app folders the generator needs.

### `run_jhipster`

The **escape hatch** for subcommands without a dedicated tool. The subcommand must be on an allowlist and every arg must avoid shell metacharacters; `--force` is appended automatically.

| Arg | Required | Notes |
|-----|:---:|-------|
| `workingDirectory` | ✅ | |
| `subcommand` | ✅ | Must be allowlisted (e.g. `export-jdl`, `languages`, `openapi-client`, `kubernetes`, `docker-compose`, `upgrade`, deploy targets). |
| `args` | | Extra args; each validated against a safe character pattern. |

See [Advanced usage](08-advanced-and-customization.md#the-run_jhipster-escape-hatch) for the full allowlist and when to reach for it.

---

## Dry run: preview without writing

Pass **`dryRun: true`** to any of the five applying tools to get a true no-write preview. The server generates the change in a **throwaway temp copy** of your project (copying in `.yo-rc.json` and `.jhipster/` for faithful context), reports what *would* be produced, and discards it. Your project is never modified.

> ⚠️ This is **not** JHipster's `--dry-run`. In JHipster 9, `--dry-run` only *prints conflicts* — it still writes files. So this server isolates instead of relying on that flag. See [page 7](07-context-management.md#dry-run-is-isolation-not-a-flag).

## Safe-apply: backup & rollback

The four tools that modify an **existing** project — `import_jdl`, `add_entity`, `add_relationship`, `set_option` — accept an opt-in **`backup: true`**. Before the `--force` run, the server copies your project into a temp backup directory (excluding large regenerable folders: `node_modules`, `.git`, `target`, `build`, `dist`, `.gradle`), so a bad generation is one restore away.

- The backup path and a one-line change summary are surfaced in the result text, with a ready-to-paste `cp -R … && rm -rf …` rollback command.
- The path is also in `structuredContent.backupPath`.
- It's a **backup directory, not git** — the server never touches your repo, consistent with its no-git principle. (Resolving conflicts and committing remain yours, via your own git.)
- Ignored on a dry run (nothing is written, so nothing needs backing up). `create_app_from_jdl` has no `backup` flag — it requires an empty directory, so there's nothing to snapshot.

> Use it for risky changes to a project with uncommitted work. If your project is already under git with a clean tree, a commit/stash is just as good — `backup` is there for when it isn't.

## Structured output

Every tool that runs `jhipster` returns machine-readable `structuredContent` alongside the text, against a shared schema:

```jsonc
{
  "command": "jhipster jdl changes.jdl --force --skip-git",
  "exitCode": 0,
  "success": true,
  "dryRun": false,
  "entities": ["Customer", "Order"],          // parsed from the applied JDL
  "filesChanged": [{ "action": "create", "path": "src/main/java/..." }],
  "warnings": ["WARNING! ..."],
  "backupPath": "/tmp/jhipster-mcp-backup-shop-XXXX"  // only when backup: true
}
```

Pre-flight guard failures (allowlist, non-empty dir, lint errors) return an `isError` text result **without** `structuredContent`. More on why this matters in [page 7](07-context-management.md).

---

Next: [Resources](05-resources.md) — the read-only data the agent pulls.
