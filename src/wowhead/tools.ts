import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WowheadForeverClient } from './client.js';
import { WowheadDataClient } from './dataClient.js';
import { findClass, WOW_CLASSES } from './classes.js';
import { findDungeons, FOREVER_DUNGEONS } from './dungeons.js';
import { entityTypeEnum } from './types.js';
import { checkUsability, compareItems, type ItemInfo } from './itemInfo.js';
import { enrichCandidates, filterZoneQuests, findRewardCandidates } from './questRewards.js';

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
    'Fetch detailed item statistics, item level, equip/use effects, and tooltip from Wowhead Forever by item ID. ' +
      'Includes structured info (type, slot, DPS, stats, class/race restrictions) when available.',
    {
      id: z.number().int().positive().describe('Wowhead item ID (e.g. 19019 for Thunderfury, 252484 for Timbermaw Tunic)'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
    },
    async ({ id, locale }) => {
      try {
        const details = await client.getTooltip('item', id, locale);
        let info: ItemInfo | undefined;
        try {
          info = await client.getItemInfo(id);
        } catch {
          // Structured info is best effort; the tooltip is still useful without it
        }
        return jsonContent(info ? { ...details, info } : details);
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
      limit: z.number().int().min(1).max(100).default(15).describe('Maximum number of rows/entries to return per table category (default: 15 to prevent huge responses)'),
    },
    async ({ id, section, limit }) => {
      try {
        const sources = await client.getItemSources(id);
        const applyLimit = <T>(arr?: T[]): T[] | undefined => (arr ? arr.slice(0, limit) : undefined);

        if (section === 'all') {
          return jsonContent({
            ...sources,
            droppedBy: applyLimit(sources.droppedBy),
            skinnedFrom: applyLimit(sources.skinnedFrom),
            containedInObject: applyLimit(sources.containedInObject),
            minedFromObject: applyLimit(sources.minedFromObject),
            gatheredFromObject: applyLimit(sources.gatheredFromObject),
            soldBy: applyLimit(sources.soldBy),
            rewardFromQuests: applyLimit(sources.rewardFromQuests),
            craftedBy: applyLimit(sources.craftedBy),
            reagentFor: applyLimit(sources.reagentFor),
            canBePlacedIn: applyLimit(sources.canBePlacedIn),
            seeAlso: applyLimit(sources.seeAlso),
            comments: applyLimit(sources.comments),
          });
        }

        const filtered: Record<string, any> = { itemId: id, section };
        switch (section) {
          case 'dropped-by':
            filtered['droppedBy'] = applyLimit(sources.droppedBy);
            break;
          case 'contained-in':
            filtered['containedIn'] = applyLimit(sources.containedInObject);
            break;
          case 'skinned-from':
            filtered['skinnedFrom'] = applyLimit(sources.skinnedFrom);
            break;
          case 'reagent-for':
            filtered['reagentFor'] = applyLimit(sources.reagentFor);
            break;
          case 'can-be-placed-in':
            filtered['canBePlacedIn'] = applyLimit(sources.canBePlacedIn);
            break;
          case 'see-also':
            filtered['seeAlso'] = applyLimit(sources.seeAlso);
            break;
          case 'sold-by':
            filtered['soldBy'] = applyLimit(sources.soldBy);
            break;
          case 'crafted-by':
            filtered['craftedBy'] = applyLimit(sources.craftedBy);
            break;
          case 'reward-from-quests':
            filtered['rewardFromQuests'] = applyLimit(sources.rewardFromQuests);
            break;
          case 'comments':
            filtered['comments'] = applyLimit(sources.comments);
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
    'Fetch a Wowhead Forever quest by ID: objectives, rewards (items with type/DPS/stats/restrictions, XP, money, reputation), ' +
      'level, required level, side, start/end NPCs, and its quest chain (previous/next/final step). ' +
      'rewardsStatus is "ok", "none" (quest gives no rewards), or "unavailable" (page could not be fetched).',
    {
      id: z.number().int().positive().describe('Wowhead quest ID (e.g. 7787 for "Rise, Thunderfury!")'),
      locale: z.union([z.string(), z.number()]).default(0).describe('Locale code or number (0 for English). Default: 0'),
      includeItemInfo: z.boolean().default(true).describe('Attach structured stats (type, slot, DPS, stats, class/race restrictions) to each reward item. Default: true'),
    },
    async ({ id, locale, includeItemInfo }) => {
      try {
        const details = await client.getTooltip('quest', id, locale);
        const items = details.rewards?.items;
        if (!includeItemInfo || !items || items.length === 0) {
          return jsonContent(details);
        }
        const infos = await client.getItemInfos(items.map((i) => i.id));
        return jsonContent({
          ...details,
          rewards: {
            ...details.rewards,
            items: items.map((i) => ({ ...i, info: infos.get(i.id) })),
          },
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_list_zone_quests ───────────────────────────
  server.tool(
    'wowhead_list_zone_quests',
    'List the quests of one or more Wowhead Forever zones with level, required level, side, XP, money, reputation, ' +
      'item rewards/choices, and class/race restrictions. Filter by faction, level range, and completed quests ' +
      '(pass ids from wow_character_completedQuests as excludeQuestIds). Zone IDs: e.g. 14 Durotar, 215 Mulgore, 17 The Barrens, 406 Stonetalon Mountains, 12 Elwynn Forest.',
    {
      zoneIds: z.array(z.number().int().positive()).min(1).max(10).describe('Wowhead zone IDs (e.g. [14, 215, 17])'),
      faction: z.enum(['Alliance', 'Horde', 'Both']).optional().describe('Keep quests available to this faction'),
      minQuestLevel: z.number().int().min(1).max(60).optional().describe('Minimum quest level'),
      maxQuestLevel: z.number().int().min(1).max(60).optional().describe('Maximum quest level'),
      maxRequiredLevel: z.number().int().min(1).max(60).optional().describe('Hide quests whose required level is above this (usually the character level)'),
      className: z.string().optional().describe('Hide quests restricted to other classes (e.g. "shaman")'),
      race: z.string().optional().describe('Hide quests restricted to other races (e.g. "Troll")'),
      excludeQuestIds: z.array(z.number().int().positive()).optional().describe('Quest IDs to hide, e.g. already completed or in the quest log'),
      onlyWithItemRewards: z.boolean().default(false).describe('Only quests that reward or offer items'),
      limit: z.number().int().min(1).max(300).default(100).describe('Maximum quests to return (default: 100)'),
    },
    async ({ zoneIds, limit, ...filters }) => {
      try {
        const pages = await Promise.all(zoneIds.map((z) => client.getZoneQuests(z)));
        const quests = filterZoneQuests(pages, filters);
        return jsonContent({
          zones: pages.map((p) => ({ zoneId: p.zoneId, zoneName: p.zoneName, totalQuests: p.quests.length })),
          filters,
          count: quests.length,
          truncated: quests.length > limit,
          quests: quests.slice(0, limit),
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_find_quest_rewards ─────────────────────────
  server.tool(
    'wowhead_find_quest_rewards',
    'Find quest reward items (weapons/armor) across Wowhead Forever zones that a character can use, sorted by usability then DPS. ' +
      'Filters by class proficiency, race, character level, faction, item type/subclass, minimum DPS, and completed quests. ' +
      'Optionally compares each candidate with the currently equipped item. Zone IDs: e.g. 14 Durotar, 215 Mulgore, 17 The Barrens.',
    {
      zoneIds: z.array(z.number().int().positive()).min(1).max(10).describe('Wowhead zone IDs to search (e.g. [14, 215, 17])'),
      className: z.string().optional().describe('Character class for proficiency checks (e.g. "shaman")'),
      race: z.string().optional().describe('Character race for race-restricted items/quests (e.g. "Troll")'),
      characterLevel: z.number().int().min(1).max(60).optional().describe('Character level: hides quests/items above it'),
      faction: z.enum(['Alliance', 'Horde', 'Both']).optional().describe('Character faction'),
      itemClass: z.enum(['weapon', 'armor', 'any']).default('any').describe('Item category to search'),
      subclasses: z.array(z.string()).optional().describe('Keep only these subclasses, e.g. ["Staff", "Dagger", "One-Handed Mace"]'),
      minDps: z.number().min(0).optional().describe('Minimum weapon DPS'),
      minQuestLevel: z.number().int().min(1).max(60).optional().describe('Minimum quest level'),
      maxQuestLevel: z.number().int().min(1).max(60).optional().describe('Maximum quest level'),
      excludeQuestIds: z.array(z.number().int().positive()).optional().describe('Quest IDs to skip (completed quests from wow_character_completedQuests)'),
      compareToItemId: z.number().int().positive().optional().describe('Currently equipped item ID to compare against (DPS/stat deltas)'),
      includeUnusable: z.boolean().default(false).describe('Also list items the character cannot use, with reasons'),
      includeTalentGated: z.boolean().default(false).describe('Treat talent-unlocked weapon types (e.g. Shaman two-handed axes/maces) as usable'),
      includeStats: z.boolean().default(true).describe('Fetch full stats/restrictions for returned items (one request per item)'),
      limit: z.number().int().min(1).max(50).default(15).describe('Maximum candidates to return (default: 15)'),
    },
    async ({ zoneIds, compareToItemId, includeStats, limit, ...opts }) => {
      try {
        const pages = await Promise.all(zoneIds.map((z) => client.getZoneQuests(z)));
        let candidates = findRewardCandidates(pages, opts);
        const totalMatches = candidates.length;
        // Over-fetch slightly: full stats can reveal class/race restrictions that drop candidates
        candidates = candidates.slice(0, includeStats ? Math.min(limit * 2, 60) : limit);

        let current: ItemInfo | undefined;
        if (compareToItemId) current = await client.getItemInfo(compareToItemId);

        if (includeStats || current) {
          const infos = includeStats ? await client.getItemInfos(candidates.map((c) => c.item.id)) : new Map();
          candidates = enrichCandidates(candidates, infos, opts, current);
          if (!opts.includeUnusable) candidates = candidates.filter((c) => c.usable);
        }

        return jsonContent({
          zones: pages.map((p) => ({ zoneId: p.zoneId, zoneName: p.zoneName })),
          comparedTo: current ? { id: current.id, name: current.name, dps: current.dps, stats: current.stats } : undefined,
          totalMatches,
          count: Math.min(candidates.length, limit),
          candidates: candidates.slice(0, limit),
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_compare_items ──────────────────────────────
  server.tool(
    'wowhead_compare_items',
    'Compare Wowhead Forever items against a currently equipped item: DPS, speed, armor, item level and stat deltas, ' +
      'plus whether a given class/race/level can use each one.',
    {
      itemIds: z.array(z.number().int().positive()).min(1).max(20).describe('Candidate item IDs'),
      compareToItemId: z.number().int().positive().describe('Currently equipped item ID'),
      className: z.string().optional().describe('Character class for proficiency checks'),
      race: z.string().optional().describe('Character race'),
      characterLevel: z.number().int().min(1).max(60).optional().describe('Character level'),
    },
    async ({ itemIds, compareToItemId, className, race, characterLevel }) => {
      try {
        const infos = await client.getItemInfos([compareToItemId, ...itemIds]);
        const current = infos.get(compareToItemId);
        if (!current || 'error' in current) {
          return errorContent(`Could not load item #${compareToItemId}: ${current && 'error' in current ? current.error : 'unknown error'}`);
        }
        const results = itemIds.map((id) => {
          const info = infos.get(id);
          if (!info || 'error' in info) return { itemId: id, error: info && 'error' in info ? info.error : 'not loaded' };
          const usability = checkUsability(info, { className, race, level: characterLevel });
          return {
            item: info,
            usable: usability.usable,
            unusableReasons: usability.usable ? undefined : usability.reasons,
            comparison: compareItems(info, current),
          };
        });
        return jsonContent({ current, results });
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

  // ── wowhead_get_class_guides ──────────────────────────
  server.tool(
    'wowhead_get_class_guides',
    'Search and retrieve Wowhead Forever class, spec, leveling, gearing, and rotation guides.',
    {
      className: z.string().optional().describe('Class name (e.g. "shaman", "warrior", "druid")'),
      specName: z.string().optional().describe('Specialization name (e.g. "restoration", "elemental", "enhancement")'),
      guideType: z.enum(['overview', 'leveling', 'talents', 'gear', 'rotation', 'all']).default('all').describe('Guide topic: "overview", "leveling", "talents", "gear", "rotation", or "all"'),
      query: z.string().optional().describe('Additional search keywords (e.g. "stat priority", "beginner")'),
      limit: z.number().int().min(1).max(25).default(10).describe('Maximum number of guides to return (default: 10)'),
    },
    async ({ className, specName, guideType, query, limit }) => {
      try {
        const guides = await client.getGuides({
          className,
          specName,
          guideType,
          query,
          limit,
        });
        return jsonContent({
          count: guides.length,
          guides,
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_dungeon_quests ────────────────────────
  server.tool(
    'wowhead_get_dungeon_quests',
    'Comprehensive dungeon leveling guide & quest index for WoW Forever (based on Wowhead\'s "Every Dungeon Quest in WoW Forever" guide #34916). Returns dungeon level ranges, quest givers, locations, and strategy guide links.',
    {
      level: z.number().int().min(1).max(60).optional().describe('Character level (e.g. 20, 35) to find appropriate dungeons and quests for leveling'),
      faction: z.enum(['Alliance', 'Horde', 'Both']).default('Both').describe('Filter by faction: "Alliance", "Horde", or "Both"'),
      dungeonName: z.string().optional().describe('Filter by specific dungeon name or keyword (e.g. "Deadmines", "Hall of Thanes", "Dalaran", "Wailing Caverns")'),
    },
    async ({ level, faction, dungeonName }) => {
      try {
        const dungeons = findDungeons({
          level,
          faction,
          searchQuery: dungeonName,
        });

        return jsonContent({
          masterGuide: {
            title: 'Every Dungeon Quest in WoW Forever',
            id: 34916,
            url: 'https://www.wowhead.com/forever/guide/dungeons/every-dungeon-quest-location',
            description: 'Every Dungeon Quest in WoW Forever. Level required, is it Shareable, Locations and More.',
          },
          filter: { level, faction, dungeonName },
          count: dungeons.length,
          dungeons,
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

  // ── wowhead_set_session_token ─────────────────────────
  server.tool(
    'wowhead_set_session_token',
    'Set or refresh the Wowhead aws-waf-token session cookie at runtime and optionally persist it to .env.',
    {
      token: z.string().min(10).describe('The aws-waf-token value or full cookie header string (e.g. "aws-waf-token=...") copied from browser cookies.'),
      persistToEnv: z.boolean().default(true).describe('Whether to save the updated cookie to the local .env file so it persists across server restarts (default: true).'),
    },
    async ({ token, persistToEnv }) => {
      try {
        client.setCookie(token);

        let savedToEnv = false;
        if (persistToEnv) {
          const envPath = path.resolve(process.cwd(), '.env');
          const normalizedCookie = token.trim().startsWith('aws-waf-token=')
            ? token.trim()
            : `aws-waf-token=${token.trim()}`;
          const newLine = `WOWHEAD_COOKIE="${normalizedCookie}"`;

          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            if (/^WOWHEAD_COOKIE=.*$/m.test(content)) {
              fs.writeFileSync(envPath, content.replace(/^WOWHEAD_COOKIE=.*$/m, newLine), 'utf8');
            } else {
              fs.writeFileSync(envPath, `${newLine}\n${content}`, 'utf8');
            }
          } else {
            fs.writeFileSync(envPath, `${newLine}\n`, 'utf8');
          }
          savedToEnv = true;
        }

        return jsonContent({
          success: true,
          savedToEnv,
          message: savedToEnv
            ? 'Wowhead session cookie successfully updated and saved to .env.'
            : 'Wowhead session cookie successfully updated for this MCP session.',
        });
      } catch (err) {
        return errorContent(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── wowhead_get_session_status ────────────────────────
  server.tool(
    'wowhead_get_session_status',
    'Check if an aws-waf-token cookie is currently configured and test if it is valid or expired against Wowhead.',
    {
      testConnection: z.boolean().default(false).describe('If true, performs a test probe to verify if the current token is valid or expired.'),
    },
    async ({ testConnection }) => {
      const cookie = client.getCookie();
      const hasCookie = Boolean(cookie && cookie.length > 0);

      if (!hasCookie) {
        return jsonContent({
          status: 'missing',
          hasCookie: false,
          message: 'No aws-waf-token cookie is currently set. Provide one via wowhead_set_session_token or WOWHEAD_COOKIE in .env.',
        });
      }

      if (testConnection) {
        try {
          // Probe a known Listview item page to test the token
          await client.getItemSources(7298);
          return jsonContent({
            status: 'valid',
            hasCookie: true,
            cookiePrefix: `${cookie!.slice(0, 30)}...`,
            message: 'Session token is active and successfully passed CloudFront/WAF verification.',
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isExpired = errMsg.includes('[WAF_VERIFICATION_REQUIRED]') || errMsg.includes('verification required');
          return jsonContent({
            status: isExpired ? 'expired' : 'error',
            hasCookie: true,
            cookiePrefix: `${cookie!.slice(0, 30)}...`,
            isExpired,
            message: isExpired
              ? 'The configured aws-waf-token has expired. Please refresh the token using wowhead_set_session_token.'
              : `Connection test failed: ${errMsg}`,
          });
        }
      }

      return jsonContent({
        status: 'configured',
        hasCookie: true,
        cookiePrefix: `${cookie!.slice(0, 30)}...`,
        message: 'Session cookie is configured. Pass testConnection: true to actively probe validity.',
      });
    },
  );
}
