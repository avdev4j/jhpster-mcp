import path from "node:path";

/**
 * Server configuration read from the environment at startup. Everything here is
 * optional — with no env set, the server behaves exactly as before (no jail,
 * no extra flags, global `jhipster`). Configuring it lets a host expose the
 * server to less-trusted callers: confine writes to a directory, pin the
 * generator version, and force default flags onto every run.
 *
 * Env vars:
 *   JHIPSTER_MCP_ROOT               absolute dir the server refuses to escape
 *   JHIPSTER_MCP_DEFAULT_ARGS       whitespace-separated flags added to every run
 *   JHIPSTER_MCP_GENERATOR_VERSION  pin generator-jhipster (run via npx)
 */
export interface ServerConfig {
  /** Absolute root that every user-supplied workingDirectory/dir must stay within. */
  rootDir?: string;
  /** Flags appended to every `jhipster` invocation. */
  defaultArgs: string[];
  /** Pinned generator-jhipster version/tag; when set, runs are dispatched via npx. */
  generatorVersion?: string;
}

// Same permissive-but-shell-safe arg class used by the run_jhipster allowlist.
const ARG_OK = /^[A-Za-z0-9_./=:@,+-]+$/;
const VERSION_OK = /^[A-Za-z0-9._-]+$/;

let cached: ServerConfig | undefined;

/** Parse + validate config from an env bag. Throws on malformed values (fail fast at startup). */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rootRaw = env.JHIPSTER_MCP_ROOT?.trim();
  if (rootRaw && !path.isAbsolute(rootRaw)) {
    throw new Error(`JHIPSTER_MCP_ROOT must be an absolute path, got: ${rootRaw}`);
  }

  const defaultArgs = (env.JHIPSTER_MCP_DEFAULT_ARGS?.trim() ?? "")
    .split(/\s+/)
    .filter((a) => a.length > 0);
  for (const arg of defaultArgs) {
    if (!ARG_OK.test(arg)) {
      throw new Error(`JHIPSTER_MCP_DEFAULT_ARGS contains an unsafe argument: "${arg}"`);
    }
  }

  const generatorVersion = env.JHIPSTER_MCP_GENERATOR_VERSION?.trim() || undefined;
  if (generatorVersion && !VERSION_OK.test(generatorVersion)) {
    throw new Error(`JHIPSTER_MCP_GENERATOR_VERSION is not a valid version/tag: "${generatorVersion}"`);
  }

  return {
    rootDir: rootRaw ? path.resolve(rootRaw) : undefined,
    defaultArgs,
    generatorVersion,
  };
}

/** Memoized config for the process. */
export function getConfig(): ServerConfig {
  return (cached ??= readConfig());
}

/** Test seam: clear the memoized config so the next getConfig() re-reads the env. */
export function resetConfigForTest(): void {
  cached = undefined;
}

/**
 * Enforce the sandbox root on a user-supplied directory. No-op when no root is
 * configured. Comparison is lexical (path.resolve normalizes `..`), so traversal
 * out of the root is rejected without needing the path to exist yet.
 */
export function assertWithinRoot(dir: string, cfg: ServerConfig = getConfig()): void {
  if (!cfg.rootDir) return;
  const resolved = path.resolve(dir);
  if (resolved !== cfg.rootDir && !resolved.startsWith(cfg.rootDir + path.sep)) {
    throw new Error(
      `Path "${dir}" is outside the configured sandbox root (${cfg.rootDir}). ` +
        `Set JHIPSTER_MCP_ROOT to widen it, or pass a directory inside the root.`,
    );
  }
}

/**
 * Resolve how to invoke the generator. Unpinned → the global `jhipster` binary.
 * Pinned → `npx -y -p generator-jhipster@<version> jhipster` so the exact
 * version runs regardless of what's installed globally.
 */
export function jhipsterCommand(cfg: ServerConfig = getConfig()): { command: string; prefixArgs: string[] } {
  if (cfg.generatorVersion) return jhipsterCommandForVersion(cfg.generatorVersion);
  return { command: "jhipster", prefixArgs: [] };
}

/** Build the npx invocation that runs an explicit generator version (used by the upgrade preview). */
export function jhipsterCommandForVersion(version: string): { command: string; prefixArgs: string[] } {
  if (!VERSION_OK.test(version)) {
    throw new Error(`Invalid generator version/tag: "${version}"`);
  }
  return { command: "npx", prefixArgs: ["-y", "-p", `generator-jhipster@${version}`, "jhipster"] };
}
