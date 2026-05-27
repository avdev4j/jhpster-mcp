import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  jdl: z
    .string()
    .min(1)
    .describe("JDL source to apply (entities, relationships, options, etc.)."),
  jdlFilename: z
    .string()
    .default("changes.jdl")
    .describe("Filename used to persist the JDL inside the project."),
  dryRun: z
    .boolean()
    .default(false)
    .describe(
      "Preview only: run `jhipster jdl --dry-run` so the project is not modified.",
    ),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe("Additional flags forwarded to `jhipster jdl`."),
};

export function registerImportJdl(server: McpServer): void {
  server.registerTool(
    "import_jdl",
    {
      title: "Apply JDL to an existing JHipster project",
      description:
        "Writes the provided JDL into the project directory and runs `jhipster jdl <file> --force --skip-git` to apply it (adds entities, relationships, options). Pass dryRun=true to preview without modifying the project.",
      inputSchema: inputShape,
      outputSchema: structuredOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory, jdl, jdlFilename, dryRun, extraArgs }, extra) => {
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
