import { mkdir, readdir } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
import {
  analyzeAppConfig,
  configLinesFromAnswers,
  injectConfigLines,
  type ElicitableConfigKey,
  DATABASE_OPTIONS,
  AUTH_OPTIONS,
  CLIENT_OPTIONS,
} from "../jdl/builders.js";

/** Human-friendly label + enum for each elicitable config key. */
const ELICIT_FIELDS: Record<
  ElicitableConfigKey,
  { title: string; description: string; options: readonly string[] }
> = {
  database: {
    title: "Database",
    description: "Production database (SQL options also set H2 for dev). 'none' for no database.",
    options: DATABASE_OPTIONS,
  },
  authentication: { title: "Authentication", description: "Authentication mechanism.", options: AUTH_OPTIONS },
  clientFramework: { title: "Client framework", description: "Front-end framework ('none' = API only).", options: CLIENT_OPTIONS },
};

/**
 * When the app config omits database/auth/client and the client supports
 * elicitation, ask the user to fill them in. Returns the (possibly augmented)
 * JDL, or `{ cancelled: true }` if the user cancelled. Degrades silently to the
 * original JDL when elicitation is unsupported, declined, or errors — so
 * automated hosts keep working exactly as before.
 */
async function elicitMissingConfig(
  server: McpServer,
  jdl: string,
): Promise<{ jdl: string } | { cancelled: true }> {
  const { appBlockCount, hasConfigBlock, missing } = analyzeAppConfig(jdl);
  // Only act on a single-application JDL with a config block and real gaps.
  if (appBlockCount !== 1 || !hasConfigBlock || missing.length === 0) return { jdl };
  if (!server.server.getClientCapabilities()?.elicitation) return { jdl };

  const properties: Record<string, { type: "string"; title: string; description: string; enum: string[] }> = {};
  for (const key of missing) {
    const f = ELICIT_FIELDS[key];
    properties[key] = { type: "string", title: f.title, description: f.description, enum: [...f.options] };
  }

  try {
    const res = await server.server.elicitInput({
      message: `This JDL's application config doesn't specify ${missing.join(", ")}. Pick values to set them, or decline to let JHipster use its defaults.`,
      requestedSchema: { type: "object", properties },
    });
    if (res.action === "cancel") return { cancelled: true };
    if (res.action === "accept" && res.content) {
      const answers = res.content as Partial<Record<ElicitableConfigKey, string>>;
      return { jdl: injectConfigLines(jdl, configLinesFromAnswers(answers)) };
    }
    return { jdl }; // declined → defaults
  } catch {
    return { jdl }; // any elicitation failure → proceed with original JDL
  }
}

const inputShape = {
  workingDirectory: z
    .string()
    .describe(
      "Absolute path of an empty (or non-existent) directory where the application will be scaffolded.",
    ),
  jdl: z
    .string()
    .min(1)
    .describe(
      "Full JDL source defining at least one `application { config { ... } }` block. May also include entities and relationships.",
    ),
  jdlFilename: z
    .string()
    .default("app.jdl")
    .describe("Filename used to persist the JDL inside the target directory."),
  dryRun: z
    .boolean()
    .default(false)
    .describe(
      "Preview only: run `jhipster jdl --dry-run` so no files are written (the JDL is staged in a temp file). Use to validate and see what would be generated.",
    ),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe(
      "Additional flags forwarded to `jhipster jdl` (e.g. ['--skip-install']).",
    ),
};

export function registerCreateAppFromJdl(server: McpServer): void {
  server.registerTool(
    "create_app_from_jdl",
    {
      title: "Create JHipster application from JDL",
      description:
        "Scaffolds a new JHipster application by writing a JDL file to the target directory and running `jhipster jdl <file> --force --skip-git`. The directory should be empty. Pass dryRun=true to preview without writing.",
      inputSchema: inputShape,
      outputSchema: structuredOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory, jdl, jdlFilename, dryRun, extraArgs }, extra) => {
      await mkdir(workingDirectory, { recursive: true });
      const entries = await readdir(workingDirectory);
      const allowList = new Set([".git", ".DS_Store"]);
      const conflicting = entries.filter((e) => !allowList.has(e));
      if (conflicting.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Refusing to scaffold: directory not empty (${conflicting.slice(0, 10).join(", ")}${conflicting.length > 10 ? ", ..." : ""}). Use import_jdl to apply JDL to an existing project.`,
            },
          ],
        };
      }

      // Ask the user for any unspecified database/auth/client before a real
      // generation (skipped on a dry run, which is a quick throwaway preview).
      let finalJdl = jdl;
      if (!dryRun) {
        const elicited = await elicitMissingConfig(server, jdl);
        if ("cancelled" in elicited) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Cancelled — no application was generated. Re-run with the config you want in the JDL." },
            ],
          };
        }
        finalJdl = elicited.jdl;
      }

      const result = await applyJdl({
        workingDirectory,
        jdl: finalJdl,
        filename: jdlFilename,
        dryRun,
        extraArgs,
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatApplyResult(finalJdl, result, false) }],
        structuredContent: toStructuredResult(result, { jdl: finalJdl, dryRun: result.dryRun }),
      };
    },
  );
}
