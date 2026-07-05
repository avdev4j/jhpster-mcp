import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runJhipster, formatRunResult } from "../jhipster.js";
import { makeProgressReporter } from "../progress.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
import { assertWithinRoot } from "../config.js";

const ALLOWED_SUBCOMMANDS = new Set([
  "info",
  "jdl",
  "entity",
  "import-jdl",
  "ci-cd",
  "upgrade",
  "languages",
  "openapi-client",
  "kubernetes",
  "docker-compose",
  "heroku",
  "azure-app-service",
  "azure-spring-cloud",
  "aws-amplify",
  "export-jdl",
  "completion",
]);

const ARG_PATTERN = /^[A-Za-z0-9_./=:@,+-]+$/;

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of the project (or empty directory for scaffolds)."),
  subcommand: z
    .string()
    .describe(
      `JHipster subcommand. Must be one of: ${[...ALLOWED_SUBCOMMANDS].join(", ")}.`,
    ),
  args: z
    .array(z.string())
    .default([])
    .describe(
      "Arguments forwarded to the subcommand. Each argument must match [A-Za-z0-9_./=:@,+-]+ — no shell metacharacters.",
    ),
};

export function registerRunJhipster(server: McpServer): void {
  server.registerTool(
    "run_jhipster",
    {
      title: "Run an arbitrary jhipster subcommand (allowlisted)",
      description:
        "Escape hatch for subcommands not covered by dedicated tools. Subcommand must be allowlisted and each arg must avoid shell metacharacters. `--force` is appended automatically to keep execution non-interactive.",
      inputSchema: inputShape,
      outputSchema: structuredOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ workingDirectory, subcommand, args }, extra) => {
      if (!ALLOWED_SUBCOMMANDS.has(subcommand)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Subcommand "${subcommand}" is not allowlisted. Allowed: ${[...ALLOWED_SUBCOMMANDS].join(", ")}`,
            },
          ],
        };
      }
      for (const a of args) {
        if (!ARG_PATTERN.test(a)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Argument "${a}" contains disallowed characters. Allowed pattern: ${ARG_PATTERN}`,
              },
            ],
          };
        }
      }
      assertWithinRoot(workingDirectory);
      const fullArgs = [subcommand, ...args];
      if (!fullArgs.includes("--force")) fullArgs.push("--force");
      const result = await runJhipster({
        cwd: workingDirectory,
        args: fullArgs,
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
