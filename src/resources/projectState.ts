import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir, access, constants } from "node:fs/promises";
import path from "node:path";
import { exportJdlIsolated } from "../apply.js";

/**
 * Resources expose the current project state so an agent can read what exists
 * before mutating it, instead of guessing. Each is keyed to a project directory
 * via a `{?dir}` query variable (resources have no `workingDirectory` argument
 * the way tools do). All three are read-only — `jdl` runs `export-jdl` in an
 * isolated temp copy, so even it never writes to the project.
 */

/** Pull the (absolute) project dir out of a resolved `{?dir}` template variable. */
function dirOf(variables: Record<string, string | string[]>): string {
  const raw = variables.dir;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    throw new Error("Missing required `dir` query parameter (absolute path to the project).");
  }
  // RFC 6570 query expansion arrives percent-encoded; the SDK does not decode it.
  const dir = decodeURIComponent(value);
  if (!path.isAbsolute(dir)) {
    throw new Error(`dir must be an absolute path, got: ${dir}`);
  }
  return dir;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function registerProjectState(server: McpServer): void {
  server.registerResource(
    "project-yo-rc",
    new ResourceTemplate("jhipster://project/yo-rc{?dir}", { list: undefined }),
    {
      title: "Project .yo-rc.json",
      description:
        "The JHipster application config (.yo-rc.json) for the project at `dir`. Read this to learn the app's type, database, auth, client framework, and package before changing it.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const dir = dirOf(variables);
      const file = path.join(dir, ".yo-rc.json");
      if (!(await exists(file))) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `No .yo-rc.json found in ${dir} — not a JHipster project (or not generated yet).`,
            },
          ],
        };
      }
      const text = await readFile(file, "utf8");
      return { contents: [{ uri: uri.href, mimeType: "application/json", text }] };
    },
  );

  server.registerResource(
    "project-entities",
    new ResourceTemplate("jhipster://project/entities{?dir}", { list: undefined }),
    {
      title: "Project entity configs",
      description:
        "The entity configurations (.jhipster/*.json) for the project at `dir`, aggregated into one JSON object keyed by entity name. Read this to see which entities and fields already exist.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const dir = dirOf(variables);
      const entitiesDir = path.join(dir, ".jhipster");
      if (!(await exists(entitiesDir))) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ entities: {} }, null, 2),
            },
          ],
        };
      }
      const files = (await readdir(entitiesDir)).filter((f) => f.endsWith(".json")).sort();
      const entities: Record<string, unknown> = {};
      for (const f of files) {
        const name = f.slice(0, -".json".length);
        const raw = await readFile(path.join(entitiesDir, f), "utf8");
        try {
          entities[name] = JSON.parse(raw);
        } catch {
          entities[name] = { _parseError: true, raw };
        }
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ entities }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "project-jdl",
    new ResourceTemplate("jhipster://project/jdl{?dir}", { list: undefined }),
    {
      title: "Project JDL (export-jdl)",
      description:
        "The full JDL synthesized from the project at `dir` via `jhipster export-jdl`, run in an isolated copy so the project is never modified. Read this for a single-document view of the app config, entities, relationships, and options.",
      mimeType: "text/plain",
    },
    async (uri, variables) => {
      const dir = dirOf(variables);
      if (!(await exists(path.join(dir, ".yo-rc.json")))) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `No .yo-rc.json found in ${dir} — nothing to export (not a JHipster project).`,
            },
          ],
        };
      }
      const { jdl, result } = await exportJdlIsolated(dir);
      if (!jdl.trim()) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `export-jdl produced no JDL (exit ${result.exitCode}).\n\n${result.stderr.trim() || result.stdout.trim()}`,
            },
          ],
        };
      }
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: jdl }] };
    },
  );
}
