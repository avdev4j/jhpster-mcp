import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

const argsSchema = {
  workingDirectory: z
    .string()
    .describe("Absolute path of the existing monolith to use as the source of truth."),
  targetDirectory: z
    .string()
    .describe("Absolute path of an empty directory where the microservices JDL will be generated."),
  services: z
    .string()
    .describe(
      "How to split the domain into services, e.g. `orders: Order, OrderItem; catalog: Product, Category`. Entities not listed stay on the gateway.",
    ),
  gatewayName: z.string().optional().describe("Name for the gateway application (default `gateway`)."),
};

export function registerMonolithToMicroservices(server: McpServer): void {
  server.registerPrompt(
    "monolith_to_microservices",
    {
      title: "Plan a monolith → microservices split",
      description:
        "Turn an existing monolith's model into a gateway + microservice JDL, assigning entities to services.",
      argsSchema: z.object(argsSchema),
    },
    ({ workingDirectory, targetDirectory, services, gatewayName }) => {
      const dirParam = encodeURIComponent(workingDirectory);
      const gw = gatewayName || "gateway";
      const text = `Convert the JHipster monolith at \`${workingDirectory}\` into a microservices architecture, generating into \`${targetDirectory}\`.

1. Read the \`jhipster://project/jdl?dir=${dirParam}\` resource to get the monolith's current model (entities, fields, relationships, options) as a single JDL document. This is your source of truth — preserve the existing field definitions.
2. Design the split. Requested layout: ${services}
   - Create one \`application { config { applicationType microservice ... } }\` block per service, each with its own \`baseName\`, a distinct \`serverPort\` (8081, 8082, …), and an \`entities <Comma,List>\` line naming the entities it owns.
   - Add one \`application { config { applicationType gateway, baseName ${gw} ... } }\` block as the front door. Entities not assigned to any service stay with the gateway.
   - Keep \`authenticationType\`, \`databaseType\`, and \`packageName\` consistent with the monolith unless there's a reason to diverge; microservices typically use \`jwt\` or \`oauth2\`.
3. Carry over the entity definitions and relationships from step 1. Note: relationships should not cross service boundaries — flag any in the source model that would, and either keep both entities in the same service or replace the relationship with an id reference.
4. Carry over CRUD options (\`paginate\`, \`service\`, \`dto\`) as appropriate.
5. Validate the assembled JDL with the \`validate_jdl\` tool, then generate it with \`create_app_from_jdl\` (use \`dryRun: true\` first) targeting \`${targetDirectory}\`.

Consult \`jhipster://docs/jdl-grammar\` for the microservice/gateway JDL syntax.`;

      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
