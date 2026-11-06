#!/usr/bin/env node
/**
 * stdio entry point for the Wowhead Forever MCP server.
 * MCP clients (Claude Code, Antigravity, Cursor, etc.) launch this directly.
 * MCP protocol communication runs over stdin/stdout.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createWowheadServer } from './wowhead/server.js';
import { logger } from './util/logger.js';

const server = createWowheadServer();
const transport = new StdioServerTransport();

await server.connect(transport);
logger.info('Wowhead Forever MCP server running on stdio');

process.stdin.on('close', () => {
  logger.info('Stdin closed; exiting Wowhead Forever MCP server');
  process.exit(0);
});
