import { Client } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { InMemoryTransport } from "@modelcontextprotocol/client";

export interface McpPair {
  server: McpServer;
  client: Client;
  close: () => Promise<void>;
}

export async function createMcpPair(
  configure: (server: McpServer) => void,
): Promise<McpPair> {
  const server = new McpServer({ name: "jhipster-mcp-test", version: "0.0.0" });
  configure(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "jhipster-mcp-test-client", version: "0.0.0" });
  await client.connect(clientTransport);

  const close = async () => {
    await client.close();
    await server.close();
  };

  return { server, client, close };
}

export function getText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("\n");
}
