import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
import { buildOptionJdl } from "../jdl/builders.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  option: z
    .string()
    .describe(
      "JDL option key, e.g. paginate, service, dto, search, readOnly, filter.",
    ),
  value: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe(
      "Option value (e.g. 'pagination', 'serviceClass', 'mapstruct', 'elasticsearch'). Omit for boolean-style flags.",
    ),
  entities: z
    .array(z.string())
    .optional()
    .describe("Entities to apply the option to. Use ['*'] or omit for all entities."),
  except: z
    .array(z.string())
    .optional()
    .describe("Entities to exclude when applying to all."),
  dryRun: z
    .boolean()
    .default(false)
    .describe("Preview only: run `jhipster jdl --dry-run` so the project is not modified."),
  backup: z
    .boolean()
    .default(false)
    .describe(
      "Snapshot the project into a temp backup dir before this `--force` apply (excludes node_modules/.git/build output) so it can be rolled back. Ignored on a dry run. The backup path is surfaced in the result.",
    ),
};

export function registerSetOption(server: McpServer): void {
  server.registerTool(
    "set_option",
    {
      title: "Set a JDL option on entities",
      description:
        "Applies a JDL option line like `paginate * with pagination` to the project.",
      inputSchema: z.object(inputShape),
      outputSchema: z.object(structuredOutputShape),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory, option, value, entities, except, dryRun, backup }, extra) => {
      const jdl = buildOptionJdl({ option, value, entities, except });

      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: `option-${option}.jdl`,
        dryRun,
        backup,
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatApplyResult(jdl, result, true) }],
        structuredContent: toStructuredResult(result, {
          jdl,
          dryRun: result.dryRun,
          backupPath: result.backupPath,
        }),
      };
    },
  );
}
