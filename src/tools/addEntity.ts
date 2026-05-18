import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
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
    async ({ workingDirectory, name, fields, options }) => {
      const def: EntityDef = { name, fields, options };
      const jdl = buildEntityJdl(def);
      const filename = `entity-${name}.jdl`;
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
