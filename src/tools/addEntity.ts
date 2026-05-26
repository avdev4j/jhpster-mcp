import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { buildEntityJdl, type EntityDef } from "../jdl/builders.js";

const fieldSchema = z.object({
  name: z.string().describe("Field name in camelCase."),
  type: z
    .string()
    .describe(
      "JDL type, e.g. String, Integer, Long, BigDecimal, LocalDate, Instant, Boolean, UUID, Blob, AnyBlob, ImageBlob, TextBlob, or an enum name.",
    ),
  validations: z
    .array(z.string())
    .optional()
    .describe(
      "Validation tokens such as 'required', 'minlength(2)', 'maxlength(50)', 'min(0)', 'max(100)', 'pattern(/^[A-Z]+$/)'.",
    ),
});

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  name: z
    .string()
    .describe("Entity name in PascalCase (e.g. Customer, OrderItem)."),
  fields: z.array(fieldSchema).default([]).describe("Fields for the entity."),
  options: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe(
      "Per-entity options keyed by JDL option, applied after the entity declaration. Example: { paginate: 'pagination', service: 'serviceClass' }.",
    ),
  dryRun: z
    .boolean()
    .default(false)
    .describe("Preview only: run `jhipster jdl --dry-run` so the project is not modified."),
};

export function registerAddEntity(server: McpServer): void {
  server.registerTool(
    "add_entity",
    {
      title: "Add a single entity to a JHipster project",
      description:
        "Builds a JDL snippet for one entity (and optional per-entity options) and applies it with `jhipster jdl`.",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, name, fields, options, dryRun }, extra) => {
      const def: EntityDef = { name, fields, options };
      const jdl = buildEntityJdl(def);

      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: `entity-${name}.jdl`,
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
