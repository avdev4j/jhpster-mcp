import { mkdir, readdir } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";

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

      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: jdlFilename,
        dryRun,
        extraArgs,
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatApplyResult(jdl, result, false) }],
        structuredContent: toStructuredResult(result, { jdl, dryRun: result.dryRun }),
      };
    },
  );
}
