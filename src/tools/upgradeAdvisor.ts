import { readFile, readdir, access, constants } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertWithinRoot } from "../config.js";
import { parseVersion, classifyBump, assessUpgrade } from "../upgrade.js";

const inputShape = {
  workingDirectory: z.string().describe("Absolute path of an existing JHipster project."),
  targetVersion: z
    .string()
    .optional()
    .describe("The generator version you want to upgrade to, e.g. '8.7.4'. Omit to just report the current state."),
};

const outputShape = {
  currentVersion: z.string().nullable(),
  targetVersion: z.string().nullable(),
  bump: z.string(),
  riskLevel: z.string(),
  applicationType: z.string(),
  blueprints: z.array(z.string()),
  entityCount: z.number(),
  considerations: z.array(z.string()),
  steps: z.array(z.string()),
  references: z.array(z.string()),
};

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Pull blueprint names out of a .yo-rc blueprints array ([{name,version}] or ["name"]). */
function blueprintNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => (typeof b === "string" ? b : b && typeof b === "object" ? (b as { name?: string }).name : undefined))
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

export function registerUpgradeAdvisor(server: McpServer): void {
  server.registerTool(
    "upgrade_advisor",
    {
      title: "Advise on a JHipster version upgrade",
      description:
        "Read-only pre-flight for upgrading a project's JHipster version. Reports the current version (from .yo-rc.json), the bump type vs. a target you name, project-specific risk factors (blueprints, microservices, entity count), a recommended upgrade checklist, and official references. It does NOT run the upgrade or enumerate version-specific breaking changes — consult the linked release notes for those.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory, targetVersion }) => {
      assertWithinRoot(workingDirectory);

      const yoRc = path.join(workingDirectory, ".yo-rc.json");
      if (!(await exists(yoRc))) {
        return {
          isError: true,
          content: [{ type: "text", text: `No .yo-rc.json in ${workingDirectory} — not a JHipster project.` }],
        };
      }

      let cfg: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(await readFile(yoRc, "utf8")) as Record<string, Record<string, unknown>>;
        cfg = parsed["generator-jhipster"] ?? {};
      } catch {
        /* malformed — treated as unknown below */
      }

      const currentVersion = typeof cfg.jhipsterVersion === "string" ? cfg.jhipsterVersion : null;
      const applicationType = typeof cfg.applicationType === "string" ? cfg.applicationType : "unknown";
      const blueprints = blueprintNames(cfg.blueprints);

      let entityCount = 0;
      const jhiDir = path.join(workingDirectory, ".jhipster");
      if (await exists(jhiDir)) {
        entityCount = (await readdir(jhiDir)).filter((f) => f.endsWith(".json")).length;
      }

      const bump = classifyBump(parseVersion(currentVersion), parseVersion(targetVersion));
      const { riskLevel, considerations, steps, references } = assessUpgrade({
        bump,
        blueprints,
        applicationType,
        entityCount,
      });

      const structured = {
        currentVersion,
        targetVersion: targetVersion ?? null,
        bump,
        riskLevel,
        applicationType,
        blueprints,
        entityCount,
        considerations,
        steps,
        references,
      };

      const text = [
        `Current version: ${currentVersion ?? "unknown"}`,
        `Target version:  ${targetVersion ?? "(not provided)"}`,
        `Bump: ${bump}   Risk: ${riskLevel}`,
        `App type: ${applicationType}   Entities: ${entityCount}   Blueprints: ${blueprints.length ? blueprints.join(", ") : "none"}`,
        "",
        ...(considerations.length ? ["Considerations:", ...considerations.map((c) => `- ${c}`), ""] : []),
        "Recommended steps:",
        ...steps.map((s, i) => `${i + 1}. ${s}`),
        "",
        "References:",
        ...references.map((r) => `- ${r}`),
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: structured,
      };
    },
  );
}
