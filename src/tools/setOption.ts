import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
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
};

export function registerSetOption(server: McpServer): void {
  server.registerTool(
    "set_option",
    {
      title: "Set a JDL option on entities",
      description:
        "Applies a JDL option line like `paginate * with pagination` to the project.",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, option, value, entities, except, dryRun }, extra) => {
      const jdl = buildOptionJdl({ option, value, entities, except });

      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: `option-${option}.jdl`,
        dryRun,
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatApplyResult(jdl, result, true) }],
      };
    },
  );
}
