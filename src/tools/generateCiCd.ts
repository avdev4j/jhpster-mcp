import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
  pipeline: z
    .enum(["jenkins", "github", "gitlab", "azure", "travis", "circle"])
    .describe("Target CI/CD pipeline."),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe("Additional flags forwarded to `jhipster ci-cd`."),
};

export function registerGenerateCiCd(server: McpServer): void {
  server.registerTool(
    "generate_ci_cd",
    {
      title: "Generate CI/CD pipeline configuration",
      description:
        "Runs `jhipster ci-cd` non-interactively to scaffold a pipeline for the chosen provider.",
      inputSchema: inputShape,
    },
    async ({ workingDirectory, pipeline, extraArgs }) => {
      const result = await runJhipster({
        cwd: workingDirectory,
        args: [
          "ci-cd",
          `--ci-cd=${pipeline}`,
          "--force",
          "--skip-git",
          ...extraArgs,
        ],
      });
      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatRunResult(result) }],
      };
    },
  );
}
