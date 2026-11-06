import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WowheadForeverClient } from './client.js';
import { WowheadDataClient } from './dataClient.js';
import { findClass, WOW_CLASSES } from './classes.js';
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
  dataClient: WowheadDataClient = new WowheadDataClient(),
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
    'Fetch related tables ("Dropped by", "Contained in", "Skinned from", "Reagent for", "Can be placed in", "See also", "Sold by", "Crafted by") for an item from Wowhead Forever.',
    {
      id: z.number().int().positive().describe('Wowhead item ID (e.g. 783 for Light Leather)'),
      section: z.enum([
        'all',
        'dropped-by',
        'contained-in',
        'skinned-from',
        'reagent-for',
        'can-be-placed-in',
        'see-also',
        'sold-by',
        'crafted-by',
        'reward-from-quests',
        'comments',
      ]).default('all').describe('Optional filter for specific relation category: "dropped-by", "contained-in", "skinned-from", "reagent-for", "can-be-placed-in", "see-also", "comments", or "all"'),
    },
    async ({ id, section }) => {
      try {
        const sources = await client.getItemSources(id);
        if (section === 'all') {
          return jsonContent(sources);
        }

        const filtered: Record<string, any> = { itemId: id, section };
        switch (section) {
          case 'dropped-by':
            filtered['droppedBy'] = sources.droppedBy;
            break;
          case 'contained-in':
            filtered['containedIn'] = sources.containedInObject;
            break;
          case 'skinned-from':
            filtered['skinnedFrom'] = sources.skinnedFrom;
            break;
          case 'reagent-for':
            filtered['reagentFor'] = sources.reagentFor;
            break;
          case 'can-be-placed-in':
            filtered['canBePlacedIn'] = sources.canBePlacedIn;
            break;
          case 'see-also':
            filtered['seeAlso'] = sources.seeAlso;
            break;
          case 'sold-by':
            filtered['soldBy'] = sources.soldBy;
            break;
          case 'crafted-by':
            filtered['craftedBy'] = sources.craftedBy;
            break;
          case 'reward-from-quests':
            filtered['rewardFromQuests'] = sources.rewardFromQuests;
            break;
          case 'comments':
            filtered['comments'] = sources.comments;
            break;
        }
        return jsonContent(filtered);
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

  // ── wowhead_get_class ─────────────────────────────────
  server.tool(
    'wowhead_get_class',
    'Fetch class profile, proficiencies, combat roles, specs, talent trees, and baseline/spec ability spell IDs from Wowhead Forever.',
    {
      classIdentifier: z.union([z.string(), z.number()]).describe('Class name, slug, or ID (e.g. "shaman", "paladin", 7, "Warrior")'),
      includeTalents: z.boolean().default(false).describe('If true, fetches and parses the full talent tree (rows, columns, ranks, descriptions) for each spec'),
      includeSpellIds: z.boolean().default(false).describe('If true, fetches and includes the list of associated baseline and spec ability spell IDs from Wowhead'),
    },
    async ({ classIdentifier, includeTalents, includeSpellIds }) => {
      try {
        const classDef = findClass(classIdentifier);
        if (!classDef) {
          return errorContent(`Unknown class: "${classIdentifier}". Valid classes: ${Object.values(WOW_CLASSES).map(c => c.name).join(', ')}`);
        }

        let baselineSpells: number[] | undefined;
        const specSpells: Record<string, number[]> = {};

        if (includeSpellIds) {
          try {
            const data = await dataClient.getSpecSpells();
            baselineSpells = data.class?.[String(classDef.id)];
            for (const spec of classDef.specs) {
              specSpells[spec.name] = data.spec?.[String(spec.id)] ?? [];
            }
          } catch {
            // Best effort for spell associations
          }
        }

        let enrichedSpecs = classDef.specs;
        if (includeTalents) {
          try {
            const talentsData = await dataClient.getTalentTrees();
            enrichedSpecs = classDef.specs.map(spec => {
              const specTalentsMap = talentsData[String(spec.id)] ?? {};
              const talents = Object.values(specTalentsMap).map((t: any) => ({
                id: t.id,
                name: t.name,
                icon: t.icon,
                row: t.row,
                col: t.col,
                maxRank: Array.isArray(t.ranks) ? t.ranks.length : 1,
                rankSpellIds: Array.isArray(t.ranks) ? t.ranks : [],
                descriptions: t.descriptions ?? {},
                requiredPoints: t.requiredPoints ?? 0,
              })).sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

              return {
                ...spec,
                talents,
              };
            });
          } catch {
            // Best effort for talents
          }
        }

        return jsonContent({
          ...classDef,
          specs: enrichedSpecs,
          baselineSpellCount: baselineSpells?.length,
          baselineSpells: includeSpellIds ? baselineSpells : undefined,
          specSpells: includeSpellIds ? specSpells : undefined,
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_icon_url ──────────────────────────────
  server.tool(
    'wowhead_get_icon_url',
    'Generate direct high-resolution CDN image URLs for WoW icons (items, spells, abilities).',
    {
      iconName: z.string().describe('Icon name returned in search or tooltip responses (e.g. "inv_sword_39", "spell_fire_flamebolt")'),
      size: z.enum(['small', 'medium', 'large']).default('large').describe('Icon size: small (18x18), medium (36x36), or large (56x56)'),
    },
    async ({ iconName, size }) => {
      const url = dataClient.getIconUrl(iconName, size);
      return jsonContent({ iconName, size, url });
    },
  );

  // ── wowhead_get_scaling_data ───────────────────────────
  server.tool(
    'wowhead_get_scaling_data',
    'Fetch global combat math and stat scaling matrices from Wowhead (item budget allocations or spell coefficients).',
    {
      type: z.enum(['item', 'spell']).describe('Scaling data type: "item" for stat budgets by ilvl, "spell" for ability coefficients'),
    },
    async ({ type }) => {
      try {
        const data = type === 'item' ? await dataClient.getItemScaling() : await dataClient.getSpellScaling();
        return jsonContent({
          type,
          summary: type === 'item' ? 'Item stat budgets by level/quality' : 'Spell coefficient matrix',
          keysCount: Object.keys(data).length,
          data,
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
