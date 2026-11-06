#!/usr/bin/env node
/**
 * stdio entry point: lets MCP clients (e.g. Claude Code) launch the server
 * themselves. MCP traffic goes over stdin/stdout; logs go to stderr.
 *
 * The HTTP app is also started (best-effort) so the Battle.net login
 * callback (/bnet/callback) works for the wow_account_* tools. If the port
 * is already taken, stdio keeps working; only account login is affected.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { registerTools } from './mcp/tools.js';
import { logger } from './util/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '127.0.0.1';

const env = loadEnv();

// createApp also initialises the auth/user-token store the tools rely on.
const http = await createApp(env);
http.on('error', (err: NodeJS.ErrnoException) => {
  logger.warn(
    { code: err.code },
    'HTTP server not started on %s:%d (Battle.net login callback unavailable)',
    HOST,
    PORT,
  );
});
http.listen(PORT, HOST, () => {
  logger.info('Battle.net callback listening on http://%s:%d/bnet/callback', HOST, PORT);
});

const server = new McpServer({ name: 'mcp-wow-profile', version: '1.0.0' });
registerTools(server, env);
await server.connect(new StdioServerTransport());

// Exit when the client closes stdin so the HTTP listener doesn't linger.
process.stdin.on('close', () => process.exit(0));
