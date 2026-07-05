import { readFile, access, constants } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { assertWithinRoot } from "../config.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an existing JHipster project."),
};

const outputShape = {
  buildTool: z.string(),
  clientFramework: z.string(),
  commands: z.array(
    z.object({ category: z.string(), command: z.string(), description: z.string() }),
  ),
  notes: z.array(z.string()),
};

interface Command {
  category: string;
  command: string;
  description: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonScripts(file: string): Promise<Set<string>> {
  try {
    const pkg = JSON.parse(await readFile(file, "utf8")) as { scripts?: Record<string, string> };
    return new Set(Object.keys(pkg.scripts ?? {}));
  } catch {
    return new Set();
  }
}

/** Pure assembly of the command list from detected project facts. Exported for clarity/testing. */
export function deriveCommands(facts: {
  buildTool: "maven" | "gradle" | "unknown";
  clientFramework: string;
  hasWrapper: boolean;
  hasClient: boolean;
  scripts: Set<string>;
}): { commands: Command[]; notes: string[] } {
  const commands: Command[] = [];
  const notes: string[] = [];

  if (facts.buildTool === "maven") {
    const mvn = facts.hasWrapper ? "./mvnw" : "mvn";
    commands.push(
      { category: "run", command: mvn, description: "Start the backend in dev mode (Spring Boot)." },
      { category: "test", command: `${mvn} verify`, description: "Run backend tests." },
      { category: "package", command: `${mvn} -Pprod clean verify`, description: "Build the production jar (prod profile)." },
      { category: "docker", command: `${mvn} -Pprod verify jib:dockerBuild`, description: "Build a Docker image (prod)." },
    );
  } else if (facts.buildTool === "gradle") {
    const gw = facts.hasWrapper ? "./gradlew" : "gradle";
    commands.push(
      { category: "run", command: gw, description: "Start the backend in dev mode (Spring Boot)." },
      { category: "test", command: `${gw} test`, description: "Run backend tests." },
      { category: "package", command: `${gw} -Pprod clean bootJar`, description: "Build the production jar (prod profile)." },
      { category: "docker", command: `${gw} -Pprod bootJar jibDockerBuild`, description: "Build a Docker image (prod)." },
    );
  } else {
    notes.push("Could not determine the build tool (no buildTool in .yo-rc.json and no pom.xml/build.gradle found).");
  }

  if (facts.hasClient) {
    commands.push({ category: "build", command: "npm install", description: "Install front-end dependencies (run once)." });
    if (facts.scripts.has("start")) {
      commands.push({ category: "run", command: "npm start", description: "Start the front-end dev server (run alongside the backend)." });
    }
    for (const [script, desc] of [
      ["test", "Run front-end unit tests."],
      ["e2e", "Run end-to-end tests."],
      ["webapp:build", "Build the front-end bundle."],
      ["java:docker", "Build a Docker image for the app."],
    ] as const) {
      if (facts.scripts.has(script)) {
        commands.push({ category: script === "java:docker" ? "docker" : script === "webapp:build" ? "build" : "test", command: `npm run ${script}`, description: desc });
      }
    }
    notes.push("In dev mode, run the backend and `npm start` in parallel for live reload.");
  }

  notes.push("These commands are reported for convenience — this server never runs builds, tests, the app, or git. Run them yourself in a shell.");
  return { commands, notes };
}

export function registerProjectCommands(server: McpServer): void {
  server.registerTool(
    "project_commands",
    {
      title: "Report build/run/test commands for a project",
      description:
        "Inspects a generated JHipster project (.yo-rc.json, build files, package.json scripts) and reports the commands to build, run, test, package, and dockerize it — without running anything. Read-only.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workingDirectory }) => {
      assertWithinRoot(workingDirectory);

      const yoRc = path.join(workingDirectory, ".yo-rc.json");
      if (!(await exists(yoRc))) {
        return {
          isError: true,
          content: [
            { type: "text", text: `No .yo-rc.json in ${workingDirectory} — not a JHipster project.` },
          ],
        };
      }

      let config: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(await readFile(yoRc, "utf8")) as Record<string, Record<string, unknown>>;
        config = parsed["generator-jhipster"] ?? {};
      } catch {
        /* malformed — fall back to file detection below */
      }

      // Build tool: prefer config, else detect from build files.
      let buildTool: "maven" | "gradle" | "unknown" =
        config.buildTool === "maven" || config.buildTool === "gradle"
          ? (config.buildTool as "maven" | "gradle")
          : "unknown";
      if (buildTool === "unknown") {
        if (await exists(path.join(workingDirectory, "pom.xml"))) buildTool = "maven";
        else if (
          (await exists(path.join(workingDirectory, "build.gradle"))) ||
          (await exists(path.join(workingDirectory, "build.gradle.kts")))
        ) {
          buildTool = "gradle";
        }
      }

      const hasWrapper =
        buildTool === "maven"
          ? await exists(path.join(workingDirectory, "mvnw"))
          : buildTool === "gradle"
            ? await exists(path.join(workingDirectory, "gradlew"))
            : false;

      const clientFramework = typeof config.clientFramework === "string" ? config.clientFramework : "unknown";
      const scripts = await readJsonScripts(path.join(workingDirectory, "package.json"));
      const hasClient =
        clientFramework !== "no" && clientFramework !== "" && (scripts.size > 0 || clientFramework !== "unknown");

      const { commands, notes } = deriveCommands({ buildTool, clientFramework, hasWrapper, hasClient, scripts });

      const text = [
        `Build tool: ${buildTool}   Client: ${clientFramework}`,
        "",
        ...commands.map((c) => `[${c.category}] ${c.command}\n    ${c.description}`),
        "",
        ...notes.map((n) => `- ${n}`),
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: { buildTool, clientFramework, commands, notes },
      };
    },
  );
}
