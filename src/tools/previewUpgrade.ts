import { rm, access, constants } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { assertWithinRoot } from "../config.js";
import { makeProgressReporter } from "../progress.js";
import { regenerateProjectIsolated } from "../apply.js";
import { diffTrees } from "../diff.js";

const inputShape = {
  workingDirectory: z.string().describe("Absolute path of an existing JHipster project."),
  targetVersion: z
    .string()
    .optional()
    .describe(
      "Generator version to regenerate with, e.g. '8.7.4' (run via npx). Omit to use the generator on PATH (or JHIPSTER_MCP_GENERATOR_VERSION).",
    ),
};

const outputShape = {
  targetVersion: z.string().nullable(),
  exported: z.boolean(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  modified: z.array(z.string()),
  summary: z.object({ added: z.number(), removed: z.number(), modified: z.number() }),
  notes: z.array(z.string()),
};

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const MAX_LISTED = 100;

export function registerPreviewUpgrade(server: McpServer): void {
  server.registerTool(
    "preview_upgrade",
    {
      title: "Preview a version upgrade as a file diff",
      description:
        "Git-free upgrade preview: regenerates the project's own model in an isolated temp copy (optionally with a target generator version via npx) and diffs the result against your current files — reporting which files would be added, removed, or modified. Never writes to your project. `modified` reflects both generator changes and your own customizations; review each.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true, // may fetch a generator version via npx
      },
    },
    async ({ workingDirectory, targetVersion }, extra) => {
      assertWithinRoot(workingDirectory);
      if (!(await exists(path.join(workingDirectory, ".yo-rc.json")))) {
        return {
          isError: true,
          content: [{ type: "text", text: `No .yo-rc.json in ${workingDirectory} — not a JHipster project.` }],
        };
      }

      const regen = await regenerateProjectIsolated({
        contextDir: workingDirectory,
        generatorVersion: targetVersion,
        onData: makeProgressReporter(extra),
      });

      try {
        if (!regen.exported) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Could not export the project's JDL to regenerate from (export-jdl exit ${regen.exportResult.exitCode}).\n${regen.exportResult.stderr.trim()}`,
              },
            ],
          };
        }

        const diff = await diffTrees(workingDirectory, regen.dir, {
          // Config + the staged JDL aren't source we want in the diff.
          ignoreFile: (rel) =>
            rel === ".yo-rc.json" || rel === "upgrade-preview.jdl" || rel.endsWith(".jdl"),
        });

        const notes = [
          "`modified` includes both generator changes and your own customizations — review each before applying.",
          "This preview never touched your project; apply changes through your own git workflow.",
        ];
        const structured = {
          targetVersion: targetVersion ?? null,
          exported: true,
          added: diff.added,
          removed: diff.removed,
          modified: diff.modified,
          summary: { added: diff.added.length, removed: diff.removed.length, modified: diff.modified.length },
          notes,
        };

        const list = (label: string, items: string[]): string[] =>
          items.length === 0
            ? [`${label}: none`]
            : [`${label} (${items.length}):`, ...items.slice(0, MAX_LISTED).map((f) => `  ${f}`), ...(items.length > MAX_LISTED ? [`  …and ${items.length - MAX_LISTED} more`] : [])];

        const text = [
          `Upgrade preview${targetVersion ? ` → generator-jhipster@${targetVersion}` : ""}:`,
          `  +${diff.added.length} added  -${diff.removed.length} removed  ~${diff.modified.length} modified`,
          "",
          ...list("Added", diff.added),
          ...list("Removed", diff.removed),
          ...list("Modified", diff.modified),
          "",
          ...notes.map((n) => `- ${n}`),
        ].join("\n");

        return { content: [{ type: "text", text }], structuredContent: structured };
      } finally {
        await rm(regen.dir, { recursive: true, force: true });
      }
    },
  );
}
