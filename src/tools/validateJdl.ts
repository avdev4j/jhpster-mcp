import { access, constants } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatRunResult } from "../jhipster.js";
import { makeProgressReporter } from "../progress.js";
import { runJdlIsolated } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
import { assertWithinRoot } from "../config.js";
import { quickLintJdl } from "../jdl/builders.js";

const inputShape = {
  jdl: z.string().min(1).describe("JDL source to validate."),
  workingDirectory: z
    .string()
    .optional()
    .describe(
      "Optional absolute path of an existing project to validate against (for entity-only JDL that references existing entities). Its config/entities are copied into an isolated temp dir — nothing in your project is ever written. When omitted, validation runs against a blank workspace, best for full JDL with an `application { ... }` block.",
    ),
};

export function registerValidateJdl(server: McpServer): void {
  server.registerTool(
    "validate_jdl",
    {
      title: "Validate JDL without generating",
      description:
        "Checks JDL for errors without modifying any project. Runs a fast local structural lint (empty input, unbalanced braces), then generates from the JDL in an isolated throwaway directory (copying the project's config/entities for context when given) and discards it, so syntax/semantic errors surface before a real generation.",
      inputSchema: inputShape,
      outputSchema: structuredOutputShape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jdl, workingDirectory }, extra) => {
      // 1. Fast local lint — no spawn, works even when the CLI is unavailable.
      const lintIssues = quickLintJdl(jdl);
      if (lintIssues.length > 0) {
        return {
          isError: true,
          content: [{ type: "text", text: `Invalid JDL:\n- ${lintIssues.join("\n- ")}` }],
        };
      }

      // 2. Validate by generating in an isolated copy (never touches the project).
      if (workingDirectory) {
        assertWithinRoot(workingDirectory);
        try {
          await access(workingDirectory, constants.F_OK);
        } catch {
          return {
            isError: true,
            content: [
              { type: "text", text: `workingDirectory does not exist: ${workingDirectory}` },
            ],
          };
        }
      }

      const result = await runJdlIsolated({
        jdl,
        contextDir: workingDirectory,
        onData: makeProgressReporter(extra),
      });

      const ok = result.exitCode === 0;
      return {
        isError: !ok,
        content: [
          {
            type: "text",
            text: `${ok ? "JDL is valid (generated cleanly in an isolated copy)." : "JDL validation failed."}\n\n${formatRunResult(result)}`,
          },
        ],
        structuredContent: toStructuredResult(result, { jdl, dryRun: true }),
      };
    },
  );
}
