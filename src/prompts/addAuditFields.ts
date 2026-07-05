import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

const argsSchema = {
  workingDirectory: z.string().describe("Absolute path of the existing JHipster project."),
  entities: z
    .string()
    .optional()
    .describe(
      "Comma-separated entity names to audit. Omit to apply to every entity in the project.",
    ),
};

export function registerAddAuditFields(server: McpServer): void {
  server.registerPrompt(
    "add_audit_fields",
    {
      title: "Add audit fields to entities",
      description:
        "Add the four standard Spring Data auditing fields (createdBy, createdDate, lastModifiedBy, lastModifiedDate) to existing entities.",
      argsSchema,
    },
    ({ workingDirectory, entities }) => {
      const scope = entities?.trim()
        ? `these entities: ${entities}`
        : "every entity in the project";
      const dirParam = encodeURIComponent(workingDirectory);
      const text = `Add standard audit fields to ${scope} in the JHipster project at \`${workingDirectory}\`.

1. First read the \`jhipster://project/entities?dir=${dirParam}\` resource to see the current entities and their existing fields. Skip any entity that already has these audit fields so you don't duplicate them.
2. For each target entity, the audit fields to add are:
   - \`createdBy String\`
   - \`createdDate Instant\`
   - \`lastModifiedBy String\`
   - \`lastModifiedDate Instant\`
3. Re-declaring an existing entity in JDL redefines it, so include the entity's current fields plus the four audit fields in the JDL you build — do not emit a partial entity.
4. Apply the change with the \`import_jdl\` tool. Run it first with \`dryRun: true\` to preview, then \`dryRun: false\` once it looks right.

Note: these fields mirror JHipster's own auditing columns; populating them at runtime is the application's concern, not this generator's.`;

      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
