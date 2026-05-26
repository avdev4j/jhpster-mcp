import { mkdtemp, writeFile, rm, access, constants } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJhipster, formatRunResult } from "../jhipster.js";
import { makeProgressReporter } from "../progress.js";
import { quickLintJdl } from "../jdl/builders.js";

const inputShape = {
  jdl: z.string().min(1).describe("JDL source to validate."),
  workingDirectory: z
    .string()
    .optional()
    .describe(
      "Optional absolute path of an existing project to validate against (for entity-only JDL that references existing entities). When omitted, validation runs in an isolated temporary directory — best for full JDL that contains an `application { ... }` block. Nothing is ever written: validation always runs with `--dry-run`.",
    ),
};

export function registerValidateJdl(server: McpServer): void {
  server.registerTool(
    "validate_jdl",
    {
      title: "Validate JDL without generating",
      description:
        "Checks JDL for errors without writing any files. First runs a fast local structural lint (empty input, unbalanced braces), then a `jhipster jdl <file> --dry-run` parse so syntax/semantic errors surface before a real generation. Returns isError with the diagnostics when invalid.",
      inputSchema: inputShape,
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

      // 2. Delegate deeper validation to the generator via a dry run.
      let cwd = workingDirectory;
      let tempDir: string | undefined;
      if (cwd) {
        try {
          await access(cwd, constants.F_OK);
        } catch {
          return {
            isError: true,
            content: [
              { type: "text", text: `workingDirectory does not exist: ${cwd}` },
            ],
          };
        }
      } else {
        tempDir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-validate-"));
        cwd = tempDir;
      }

      const jdlFile = path.join(cwd, "__validate__.jdl");
      try {
        await writeFile(jdlFile, jdl, "utf8");
        const result = await runJhipster({
          cwd,
          args: ["jdl", "__validate__.jdl", "--dry-run", "--force", "--skip-git", "--skip-install"],
          onData: makeProgressReporter(extra),
        });
        const ok = result.exitCode === 0;
        return {
          isError: !ok,
          content: [
            {
              type: "text",
              text: `${ok ? "JDL is valid (dry run passed)." : "JDL validation failed."}\n\n${formatRunResult(result)}`,
            },
          ],
        };
      } finally {
        // Always remove our throwaway JDL; remove the whole temp dir if we made one.
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true });
        } else {
          await rm(jdlFile, { force: true });
        }
      }
    },
  );
}
