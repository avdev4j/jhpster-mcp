import { writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe(
      "Absolute path of an empty (or non-existent) directory where the application will be scaffolded.",
    ),
  jdl: z
    .string()
    .min(1)
    .describe(
      "Full JDL source defining at least one `application { config { ... } }` block. May also include entities and relationships.",
    ),
  jdlFilename: z
    .string()
    .default("app.jdl")
    .describe("Filename used to persist the JDL inside the target directory."),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe(
      "Additional flags forwarded to `jhipster jdl` (e.g. ['--skip-install']).",
    ),
};

export function registerCreateAppFromJdl(server: McpServer): void {
  server.registerTool(
    "create_app_from_jdl",
    {
      title: "Create JHipster application from JDL",
      description:
        "Scaffolds a new JHipster application by writing a JDL file to the target directory and running `jhipster jdl <file> --force --skip-git`. The directory should be empty.",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, jdl, jdlFilename, extraArgs }) => {
      await mkdir(workingDirectory, { recursive: true });
      const entries = await readdir(workingDirectory);
      const allowList = new Set([".git", ".DS_Store"]);
      const conflicting = entries.filter((e) => !allowList.has(e));
      if (conflicting.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Refusing to scaffold: directory not empty (${conflicting.slice(0, 10).join(", ")}${conflicting.length > 10 ? ", ..." : ""}). Use import_jdl to apply JDL to an existing project.`,
            },
          ],
        };
      }

      const jdlPath = path.join(workingDirectory, jdlFilename);
      await writeFile(jdlPath, jdl, "utf8");

      const result = await runJhipster({
        cwd: workingDirectory,
        args: ["jdl", jdlFilename, "--force", "--skip-git", ...extraArgs],
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatRunResult(result) }],
      };
    },
  );
}
