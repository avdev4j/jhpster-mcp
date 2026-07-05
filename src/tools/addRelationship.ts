import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
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
  backup: z
    .boolean()
    .default(false)
    .describe(
      "Snapshot the project into a temp backup dir before this `--force` apply (excludes node_modules/.git/build output) so it can be rolled back. Ignored on a dry run. The backup path is surfaced in the result.",
    ),
};

export function registerAddRelationship(server: McpServer): void {
  server.registerTool(
    "add_relationship",
    {
      title: "Add a relationship between two entities",
      description:
        "Builds a `relationship <kind> { A{a} to B{b} }` JDL block and applies it.",
      inputSchema: z.object(inputShape),
      outputSchema: z.object(structuredOutputShape),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory, kind, from, to, dryRun, backup }, extra) => {
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
