import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BlizzardClient } from '../blizzard/client.js';
import { gamedataEndpoints } from '../blizzard/endpoints/gamedata.js';
import { profileEndpoints } from '../blizzard/endpoints/profileEndpoints.js';
import {
  type EndpointDef,
  buildPath,
  resolveNamespace,
  isRetailOnly,
  regionSchema,
  localeSchema,
  gameSchema,
  namespaceOverrideSchema,
  type GameFlavor,
} from '../blizzard/endpoints/types.js';
import type { Region } from '../config/regions.js';
import { characterAchievementsSummarySchema } from '../blizzard/schemas/achievementSchemas.js';
import { toAchievementsTimeline } from '../blizzard/dto/timeline.js';
import { characterInputSchema } from './schemas.js';
import { logger } from '../util/logger.js';
import type { Env } from '../config/env.js';
import { enrichTimestamps } from '../util/timestamps.js';

// ── Helpers ────────────────────────────────────────────

function errorContent(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

// ── Generic endpoint registration ──────────────────────

function registerEndpoint(
  server: McpServer,
  ep: EndpointDef,
  client: BlizzardClient,
): void {
  // Every tool gets region + locale + game + namespace override + its own params
  const retailOnly = isRetailOnly(ep.toolName);
  const inputSchema: Record<string, z.ZodType> = {
    region: regionSchema,
    locale: localeSchema,
    game: gameSchema,
    namespace: namespaceOverrideSchema,
    ...ep.inputSchema,
  };

  // Search endpoints get an extra optional searchQuery param
  if (ep.isSearch) {
    inputSchema['searchQuery'] = z
      .string()
      .optional()
      .describe(
        'JSON object of search query parameters (e.g. {"name.en_US":"Thunderfury","orderby":"id","_page":1})',
      );
  }

  server.registerTool(
    ep.toolName,
    {
      title: ep.title,
      description: retailOnly
        ? `${ep.description} (Retail only — not available for Classic or Forever.)`
        : ep.description,
      inputSchema,
    },
    async (args: Record<string, unknown>) => {
      try {
        const region = (args['region'] ?? 'us') as Region;
        const locale = (args['locale'] ?? 'en_US') as string;
        const game = (args['game'] ?? 'retail') as GameFlavor;
        if (retailOnly && game !== 'retail') {
          return errorContent(
            `${ep.toolName} is only available for retail WoW, not "${game}".`,
          );
        }
        const path = buildPath(ep.path, args);
        const namespace = resolveNamespace(
          ep.namespace,
          region,
          game,
          args['namespace'] as string | undefined,
        );

        // Merge in search query params if provided
        let searchParams: Record<string, string> = {};
        if (ep.isSearch && typeof args['searchQuery'] === 'string') {
          try {
            searchParams = JSON.parse(args['searchQuery'] as string);
          } catch {
            return errorContent('searchQuery must be a valid JSON string');
          }
        }

        const data = await client.request<unknown>(path, {
          region,
          namespace,
          locale,
          searchParams,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(enrichTimestamps(data), null, 2) }],
        };
      } catch (err: unknown) {
        logger.error({ err, tool: ep.toolName }, 'Tool call failed');
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );
}

// ── Custom tools (DTO / transformation layer) ──────────

function registerCustomTools(
  server: McpServer,
  client: BlizzardClient,
): void {
  // Timeline: sorts + filters achievements into chronological order
  server.registerTool(
    'wow_character_achievementsTimeline',
    {
      title: 'Character Achievements Timeline',
      description:
        'Builds a chronologically sorted timeline of completed achievements for a character. Includes earliest/latest completion dates and total count. This is a computed view — not a raw Blizzard endpoint.',
      inputSchema: characterInputSchema,
    },
    async ({ realmSlug, characterName, region, locale, game, namespace: nsOverride }) => {
      try {
        const r = (region ?? 'us') as Region;
        const l = (locale ?? 'en_US') as string;
        const path = buildPath(
          'profile/wow/character/{realmSlug}/{characterName}/achievements',
          { realmSlug, characterName },
        );
        const namespace = resolveNamespace(
          'profile',
          r,
          (game ?? 'retail') as GameFlavor,
          nsOverride as string | undefined,
        );
        const raw = await client.request<unknown>(path, {
          region: r,
          namespace,
          locale: l,
        });
        const parsed = characterAchievementsSummarySchema.parse(raw);
        const timeline = toAchievementsTimeline(
          parsed,
          characterName as string,
        );
        return {
          content: [
            { type: 'text', text: JSON.stringify(enrichTimestamps(timeline), null, 2) },
          ],
        };
      } catch (err: unknown) {
        logger.error(
          { err },
          'wow_character_achievementsTimeline failed',
        );
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );
}

// ── Public entry point ─────────────────────────────────

export function registerTools(server: McpServer, env: Env): void {
  const client = new BlizzardClient(env);
  const allEndpoints: EndpointDef[] = [
    ...gamedataEndpoints,
    ...profileEndpoints,
  ];

  logger.info('Registering %d API endpoint tools', allEndpoints.length);

  for (const ep of allEndpoints) {
    registerEndpoint(server, ep, client);
  }

  // Custom computed tools
  registerCustomTools(server, client);

  logger.info(
    'Total tools registered: %d',
    allEndpoints.length + 1, // +1 for timeline
  );
}
