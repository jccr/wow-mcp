import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WowheadForeverClient } from './client.js';
import { entityTypeEnum } from './types.js';

function errorContent(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

function jsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerWowheadTools(
  server: McpServer,
  client: WowheadForeverClient = new WowheadForeverClient(),
): void {
  // ── wowhead_search ─────────────────────────────────────
  server.tool(
    'wowhead_search',
    'Search World of Warcraft: Forever database on Wowhead for items, spells, quests, NPCs, objects, zones, etc.',
    {
      query: z.string().min(1).describe('Search term (e.g. "thunderfury", "ragnaros", "ironforge", "ashbringer")'),
      entityType: entityTypeEnum.optional().describe('Optional filter by entity type (item, spell, quest, npc, object, zone, item-set, guide, class, race)'),
      limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of search results to return (default: 10)'),
    },
    async ({ query, entityType, limit }) => {
      try {
        const results = await client.search(query, { entityType, limit });
        return jsonContent({
          query,
          count: results.length,
          results,
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_lookup ─────────────────────────────────────
  server.tool(
    'wowhead_lookup',
    'Quick lookup: searches Wowhead Forever for an entity by name and automatically fetches its full stats/tooltip for the top match.',
    {
      query: z.string().min(1).describe('Entity name or keyword to lookup (e.g. "Thunderfury", "Fireball", "Karazhan Crypts")'),
      entityType: entityTypeEnum.optional().describe('Optional filter by entity type to narrow the match (item, spell, quest, npc, object, zone, item-set)'),
    },
    async ({ query, entityType }) => {
      try {
        const result = await client.lookup(query, entityType);
        if (!result.match && result.alternatives.length === 0) {
          return jsonContent({
            query,
            message: `No entities found matching "${query}".`,
          });
        }
        return jsonContent({
          query,
          match: result.match,
          otherMatches: result.alternatives,
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_item ───────────────────────────────────
  server.tool(
    'wowhead_get_item',
    'Fetch detailed item statistics, item level, equip/use effects, and tooltip from Wowhead Forever by item ID.',
    {
      id: z.number().int().positive().describe('Wowhead item ID (e.g. 19019 for Thunderfury, 252484 for Timbermaw Tunic)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('item', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_item_sources ───────────────────────────
  server.tool(
    'wowhead_get_item_sources',
    'Fetch drop and skinning tables ("Dropped by", "Skinned from") for an item from Wowhead Forever (loads from local snapshots or authenticated session).',
    {
      id: z.number().int().positive().describe('Wowhead item ID (e.g. 783 for Light Leather)'),
    },
    async ({ id }) => {
      try {
        const sources = await client.getItemSources(id);
        return jsonContent(sources);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_spell ──────────────────────────────────
  server.tool(
    'wowhead_get_spell',
    'Fetch spell description, cast time, mana cost, range, rank, and buff information from Wowhead Forever by spell ID.',
    {
      id: z.number().int().positive().describe('Wowhead spell ID (e.g. 133 for Fireball)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('spell', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_quest ──────────────────────────────────
  server.tool(
    'wowhead_get_quest',
    'Fetch quest description, objectives, and requirements from Wowhead Forever by quest ID.',
    {
      id: z.number().int().positive().describe('Wowhead quest ID (e.g. 7787 for "Rise, Thunderfury!")'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('quest', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_npc ────────────────────────────────────
  server.tool(
    'wowhead_get_npc',
    'Fetch NPC name, level, classification (Boss, Elite), and tooltip details from Wowhead Forever by NPC ID.',
    {
      id: z.number().int().positive().describe('Wowhead NPC ID (e.g. 10184 for Onyxia, 11502 for Ragnaros)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('npc', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_object ─────────────────────────────────
  server.tool(
    'wowhead_get_object',
    'Fetch interactive game object details from Wowhead Forever by object ID.',
    {
      id: z.number().int().positive().describe('Wowhead game object ID (e.g. 164884 for Cleansed Windblossom)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('object', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_zone ───────────────────────────────────
  server.tool(
    'wowhead_get_zone',
    'Fetch zone name, territory type, and recommended level range from Wowhead Forever by zone ID.',
    {
      id: z.number().int().positive().describe('Wowhead zone ID (e.g. 1 for Dun Morogh, 16074 for Karazhan Crypts)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('zone', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_item_set ───────────────────────────────
  server.tool(
    'wowhead_get_item_set',
    'Fetch item set name, set pieces, and set tier bonuses from Wowhead Forever by item set ID.',
    {
      id: z.number().int().positive().describe('Wowhead item set ID (e.g. 209 for Battlegear of Might)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('item-set', id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_tooltip ────────────────────────────────
  server.tool(
    'wowhead_get_tooltip',
    'Generic tooltip fetcher for any supported entity type in the Wowhead Forever database.',
    {
      entityType: entityTypeEnum.describe('Type of entity (item, spell, quest, npc, object, zone, item-set)'),
      id: z.number().int().positive().describe('Entity ID'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ entityType, id, locale }) => {
      try {
        const details = await client.getTooltip(entityType, id, locale);
        return jsonContent(details);
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
