import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
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
    async ({ workingDirectory, kind, from, to }) => {
      const jdl = buildRelationshipJdl({
        kind: kind as RelationshipKind,
        from,
        to,
      });
      const filename = `relationship-${from.entity}-${kind}-${to.entity}.jdl`;
      const filePath = path.join(workingDirectory, filename);
      await writeFile(filePath, jdl, "utf8");

      const result = await runJhipster({
        cwd: workingDirectory,
        args: ["jdl", filename, "--force", "--skip-git"],
      });

      return {
        isError: result.exitCode !== 0,
        content: [
          { type: "text", text: `Applied JDL:\n${jdl}\n\n${formatRunResult(result)}` },
        ],
      };
    },
  );
}
