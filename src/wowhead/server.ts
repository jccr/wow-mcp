import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WowheadForeverClient, type WowheadClientOptions } from './client.js';
import { registerWowheadTools } from './tools.js';

export interface CreateWowheadServerOptions {
  name?: string;
  version?: string;
  clientOptions?: WowheadClientOptions;
}

export function createWowheadServer(options: CreateWowheadServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name ?? 'wowhead-forever',
    version: options.version ?? '1.0.0',
  });

  const client = new WowheadForeverClient(options.clientOptions);
  registerWowheadTools(server, client);

  return server;
}
