import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
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
    async ({ workingDirectory, option, value, entities, except }) => {
      const jdl = buildOptionJdl({ option, value, entities, except });
      const filename = `option-${option}.jdl`;
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
