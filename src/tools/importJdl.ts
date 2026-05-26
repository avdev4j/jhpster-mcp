import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
import { makeProgressReporter } from "../progress.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  jdl: z
    .string()
    .min(1)
    .describe("JDL source to apply (entities, relationships, options, etc.)."),
  jdlFilename: z
    .string()
    .default("changes.jdl")
    .describe("Filename used to persist the JDL inside the project."),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe("Additional flags forwarded to `jhipster jdl`."),
};

export function registerImportJdl(server: McpServer): void {
  server.registerTool(
    "import_jdl",
    {
      title: "Apply JDL to an existing JHipster project",
      description:
        "Writes the provided JDL into the project directory and runs `jhipster jdl <file> --force --skip-git` to apply it (adds entities, relationships, options).",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, jdl, jdlFilename, extraArgs }, extra) => {
      const jdlPath = path.join(workingDirectory, jdlFilename);
      await writeFile(jdlPath, jdl, "utf8");

      const result = await runJhipster({
        cwd: workingDirectory,
        args: ["jdl", jdlFilename, "--force", "--skip-git", ...extraArgs],
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatRunResult(result) }],
      };
    },
  );
}
