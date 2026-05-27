import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json" with { type: "json" };

import { registerValidateJdl } from "./tools/validateJdl.js";
import { registerCreateAppFromJdl } from "./tools/createAppFromJdl.js";
import { registerImportJdl } from "./tools/importJdl.js";
import { registerAddEntity } from "./tools/addEntity.js";
import { registerAddRelationship } from "./tools/addRelationship.js";
import { registerSetOption } from "./tools/setOption.js";
import { registerInfo } from "./tools/info.js";
import { registerGenerateCiCd } from "./tools/generateCiCd.js";
import { registerGenerateDeployment } from "./tools/generateDeployment.js";
import { registerProjectCommands } from "./tools/projectCommands.js";
import { registerUpgradeAdvisor } from "./tools/upgradeAdvisor.js";
import { registerRunJhipster } from "./tools/runJhipster.js";
import { registerJdlGrammar } from "./resources/jdlGrammar.js";
import { registerProjectState } from "./resources/projectState.js";
import { registerScaffoldCrudMonolith } from "./prompts/scaffoldCrudMonolith.js";
import { registerAddAuditFields } from "./prompts/addAuditFields.js";
import { registerMonolithToMicroservices } from "./prompts/monolithToMicroservices.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  registerValidateJdl(server);
  registerCreateAppFromJdl(server);
  registerImportJdl(server);
  registerAddEntity(server);
  registerAddRelationship(server);
  registerSetOption(server);
  registerInfo(server);
  registerGenerateCiCd(server);
  registerGenerateDeployment(server);
  registerProjectCommands(server);
  registerUpgradeAdvisor(server);
  registerRunJhipster(server);
  registerJdlGrammar(server);
  registerProjectState(server);
  registerScaffoldCrudMonolith(server);
  registerAddAuditFields(server);
  registerMonolithToMicroservices(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[jhipster-mcp] fatal:", err);
  process.exit(1);
});
