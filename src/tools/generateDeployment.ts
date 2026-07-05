import { mkdir } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { makeProgressReporter } from "../progress.js";
import { applyJdl, formatApplyResult } from "../apply.js";
import { structuredOutputShape, toStructuredResult } from "../result.js";
import { assertWithinRoot } from "../config.js";
import { buildDeploymentJdl, type DeploymentConfig } from "../jdl/builders.js";

const inputShape = {
  workingDirectory: z
    .string()
    .describe(
      "Absolute path of the deployment directory (created if missing). JHipster resolves `appsFolders` relative to it, so this is typically a new folder sitting alongside your application folders.",
    ),
  deploymentType: z
    .enum(["docker-compose", "kubernetes"])
    .describe("Kind of deployment to generate."),
  appsFolders: z
    .array(z.string())
    .min(1)
    .describe("Application folder names to include, e.g. ['store', 'invoice', 'notification']."),
  dockerRepositoryName: z
    .string()
    .optional()
    .describe("Docker registry/repository prefix for the built images (e.g. 'mydockerhubuser')."),
  monitoring: z
    .enum(["no", "prometheus"])
    .optional()
    .describe("Monitoring stack to include."),
  serviceDiscoveryType: z
    .enum(["eureka", "consul", "no"])
    .optional()
    .describe("Service discovery used by the apps."),
  kubernetesNamespace: z
    .string()
    .optional()
    .describe("Kubernetes namespace (kubernetes only)."),
  kubernetesServiceType: z
    .enum(["LoadBalancer", "NodePort", "Ingress"])
    .optional()
    .describe("How services are exposed (kubernetes only)."),
  ingressDomain: z
    .string()
    .optional()
    .describe("Ingress base domain when kubernetesServiceType is Ingress (kubernetes only)."),
  istio: z.boolean().optional().describe("Enable Istio (kubernetes only)."),
  extraArgs: z
    .array(z.string())
    .default([])
    .describe("Additional flags forwarded to `jhipster jdl`."),
};

export function registerGenerateDeployment(server: McpServer): void {
  server.registerTool(
    "generate_deployment",
    {
      title: "Generate a docker-compose or kubernetes deployment",
      description:
        "Builds a declarative JDL `deployment { ... }` block for the chosen apps and applies it with `jhipster jdl` — the non-interactive way to scaffold docker-compose or kubernetes config. The named appsFolders must already be generated JHipster apps that JHipster can find relative to workingDirectory.",
      inputSchema: z.object(inputShape),
      outputSchema: z.object(structuredOutputShape),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (
      {
        workingDirectory,
        deploymentType,
        appsFolders,
        dockerRepositoryName,
        monitoring,
        serviceDiscoveryType,
        kubernetesNamespace,
        kubernetesServiceType,
        ingressDomain,
        istio,
        extraArgs,
      },
      extra,
    ) => {
      assertWithinRoot(workingDirectory);
      await mkdir(workingDirectory, { recursive: true });

      // Keep only the options the caller actually set.
      const options: DeploymentConfig["options"] = {};
      const maybe: Record<string, string | number | boolean | undefined> = {
        dockerRepositoryName,
        monitoring,
        serviceDiscoveryType,
        kubernetesNamespace,
        kubernetesServiceType,
        ingressDomain,
        istio,
      };
      for (const [k, v] of Object.entries(maybe)) {
        if (v !== undefined) options[k] = v;
      }

      const jdl = buildDeploymentJdl({ deploymentType, appsFolders, options });
      const result = await applyJdl({
        workingDirectory,
        jdl,
        filename: "deployment.jdl",
        extraArgs,
        onData: makeProgressReporter(extra),
      });

      return {
        isError: result.exitCode !== 0,
        content: [{ type: "text", text: formatApplyResult(jdl, result, true) }],
        structuredContent: toStructuredResult(result, { dryRun: result.dryRun }),
      };
    },
  );
}
