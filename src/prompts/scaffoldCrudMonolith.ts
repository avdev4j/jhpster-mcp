import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

const argsSchema = {
  workingDirectory: z
    .string()
    .describe("Absolute path of an empty (or non-existent) directory to scaffold into."),
  baseName: z.string().describe("Application name, e.g. `bookstore`."),
  entities: z
    .string()
    .describe(
      "What to model. Either a comma-separated list of entity names (e.g. `Book, Author, Order`) or a plain-English description of the domain; you will turn it into JDL entities with sensible fields.",
    ),
  database: z
    .string()
    .optional()
    .describe("Production database: postgresql (default) | mysql | mariadb | mssql | oracle | mongodb."),
  auth: z.string().optional().describe("Authentication: jwt (default) | oauth2 | session."),
  client: z.string().optional().describe("Client framework: angular (default) | react | vue | no."),
  packageName: z.string().optional().describe("Java package, e.g. `com.example.bookstore`."),
};

export function registerScaffoldCrudMonolith(server: McpServer): void {
  server.registerPrompt(
    "scaffold_crud_monolith",
    {
      title: "Scaffold a CRUD monolith",
      description:
        "Generate a complete monolithic JHipster app with full CRUD for the given entities (pagination, service layer, and DTOs wired up).",
      argsSchema,
    },
    ({ workingDirectory, baseName, entities, database, auth, client, packageName }) => {
      const db = database || "postgresql";
      const databaseType = db === "mongodb" ? "mongodb" : "sql";
      const text = `Scaffold a new JHipster monolith named \`${baseName}\` in \`${workingDirectory}\`.

Build a single JDL document, then apply it with the \`create_app_from_jdl\` tool.

Application config to use:
- applicationType monolith
- baseName ${baseName}
- authenticationType ${auth || "jwt"}
- databaseType ${databaseType}${databaseType === "sql" ? `\n- prodDatabaseType ${db}\n- devDatabaseType h2Disk` : ""}
- clientFramework ${client || "angular"}
- buildTool maven
${packageName ? `- packageName ${packageName}\n` : ""}- entities *

Entities to model: ${entities}
- Turn that into well-typed JDL entities. Pick reasonable field types and validations (e.g. \`required\`, \`maxlength\`) and add relationships where the domain implies them.
- For full CRUD, append these option lines so every entity gets pagination, a service layer, and DTOs:
  - \`paginate * with pagination\`
  - \`service * with serviceClass\`
  - \`dto * with mapstruct\`

Before generating for real, call \`create_app_from_jdl\` with \`dryRun: true\` to validate the JDL and preview what would be generated. If clean, run it again with \`dryRun: false\`. Consult the \`jhipster://docs/jdl-grammar\` resource if you need the exact JDL syntax.`;

      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
