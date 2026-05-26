import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { buildRelationshipJdl, type RelationshipKind } from "../jdl/builders.js";

const sideSchema = z.object({
  entity: z.string().describe("Entity name (PascalCase)."),
  field: z.string().describe("Field name (camelCase)."),
  required: z.boolean().optional(),
});

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  kind: z
    .enum(["OneToOne", "OneToMany", "ManyToOne", "ManyToMany"])
    .describe("Relationship cardinality."),
  from: sideSchema.describe("Owning side of the relationship."),
  to: sideSchema
    .extend({
      field: z.string().optional().describe("Optional back-reference field."),
    })
    .describe("Target side; field is optional (no back-reference if omitted)."),
  dryRun: z
    .boolean()
    .default(false)
    .describe("Preview only: run `jhipster jdl --dry-run` so the project is not modified."),
};

export function registerAddRelationship(server: McpServer): void {
  server.registerTool(
    "add_relationship",
    {
      title: "Add a relationship between two entities",
      description:
        "Builds a `relationship <kind> { A{a} to B{b} }` JDL block and applies it.",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, kind, from, to, dryRun }, extra) => {
      const jdl = buildRelationshipJdl({
        kind: kind as RelationshipKind,
        from,
        to,
      });

      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: `relationship-${from.entity}-${kind}-${to.entity}.jdl`,
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
