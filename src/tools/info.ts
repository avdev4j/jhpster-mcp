import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
import { makeProgressReporter } from "../progress.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
};

export function registerInfo(server: McpServer): void {
  server.registerTool(
    "info",
    {
      title: "Show JHipster project info",
      description:
        "Runs `jhipster info` to print versions, configuration, entities, and environment for the project.",
      inputSchema: inputShape,
      outputSchema: structuredOutputShape,
    },
    async ({ workingDirectory }, extra) => {
      const result = await runJhipster({
        cwd: workingDirectory,
        args: ["info"],
        timeoutMs: 60_000,
        onData: makeProgressReporter(extra),
      });
      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatRunResult(result) }],
        structuredContent: toStructuredResult(result),
      };
    },
  );
}
