# 8. Advanced usage & customization

← [Context management](07-context-management.md) · [Docs index](README.md) · Next → [How it works](09-how-it-works.md)

Once you're comfortable with the basics, here's how to bend the server to your workflow.

## Forward extra flags with `extraArgs`

`create_app_from_jdl`, `import_jdl`, and `generate_ci_cd` accept an `extraArgs` array that's passed straight through to the underlying `jhipster` command. Use it for generator flags this server doesn't model explicitly:

> Create the app in `/tmp/shop` but skip the npm install — pass `--skip-install`.

→ `create_app_from_jdl` with `extraArgs: ["--skip-install"]`.

Common picks: `--skip-install`, `--skip-client`, `--skip-server`, `--blueprints <name>` (blueprint support is on the [roadmap](ROADMAP.md) as a first-class option, but reachable today via `extraArgs`).

## The `run_jhipster` escape hatch

When no dedicated tool covers what you need, `run_jhipster` runs an **allowlisted** subcommand directly. The allowlist:

```
info, jdl, entity, import-jdl, ci-cd, upgrade, languages,
openapi-client, kubernetes, docker-compose, heroku,
azure-app-service, azure-spring-cloud, aws-amplify,
export-jdl, completion
```

Each arg must match a safe character pattern (`[A-Za-z0-9_./=:@,+-]`) — anything with shell metacharacters is rejected, and the server never invokes a shell. `--force` is appended automatically.

> Export the current model of `/Users/me/projects/shop` to `current.jdl`.

→ `run_jhipster` with `subcommand=export-jdl, args=["current.jdl"]`.

This is also how you reach **deployment** generators (`kubernetes`, `docker-compose`, the cloud targets) today — they don't have dedicated tools yet (also on the roadmap).

## Pin the generator and the server versions

- **Server version:** pin in your host config — `npx -y jhipster-mcp@0.0.5`. See [Installation](02-installation.md#pinning-and-global-install).
- **Generator version:** the server uses whatever global `jhipster` is on `PATH`. To pin the *generator*, manage your global install (`npm install -g generator-jhipster@<version>`). The server reports nothing about which version it'll use — run `info` (or `jhipster --version` yourself) to confirm.

## Prompting tips

These make the agent faster and more accurate:

- **Always give an absolute path.** All tools require `workingDirectory`; "the current folder" won't resolve.
- **Be specific about field types and validations** (e.g. `price BigDecimal required min(0)`) — it saves a round-trip to the grammar resource.
- **Empty the target dir first for new apps.** `create_app_from_jdl` refuses a non-empty directory.
- **Prefer one big `import_jdl` over many granular calls** for coordinated changes — one generator run instead of N.
- **Ask for a dry run when unsure.** "Show me what this would change, don't write yet" → the agent adds `dryRun: true`.
- **Use prompts for common jobs** (CRUD monolith, audit fields, microservice split) — they encode the good defaults. See [page 6](06-prompts.md).

## Safe-apply with rollback

For risky changes to a project that has uncommitted work, pass **`backup: true`** to `import_jdl`, `add_entity`, `add_relationship`, or `set_option`:

> In `/Users/me/projects/shop`, apply this JDL but take a backup first so I can roll back.

The server snapshots the project (minus `node_modules`/`.git`/build output) into a temp dir before the `--force` run, and returns the backup path plus a ready-to-paste rollback command. It's a **backup directory, not git** — your repo is untouched. If your tree is already clean under git, a commit/stash does the same job; `backup` exists for when it isn't. Details in [Tools → Safe-apply](04-tools.md#safe-apply-backup--rollback).

## Safety controls (what protects you)

- **Directory scoping** — the server only acts inside the `workingDirectory` you pass; it has no cwd of its own.
- **Opt-in backup/rollback** — `backup: true` snapshots an existing project before a `--force` apply (see above).
- **Empty-dir guard** — `create_app_from_jdl` won't overwrite a populated directory (`.git`/`.DS_Store` ignored).
- **No shell** — every spawn uses `shell: false`; `run_jhipster` validates the subcommand against the allowlist and rejects metacharacter args.
- **JDL injection guard** — entity/field/type/package names are validated against strict regexes before any JDL is built, so a malicious "name" can't inject JDL.
- **Preview-first** — `dryRun` and `validate_jdl` let you see every change before it touches disk (and they run in isolation — [page 7](07-context-management.md)).

## Scope reminder

The server **won't** run `mvn`/`npm` builds, start the app, run its tests, or touch git. That's deliberate. Use your host's shell tooling for those — keeping generation and build/run separate is what makes this server safe to hand broad access to.

---

Next: [How it works (engine)](09-how-it-works.md) — for the curious.
