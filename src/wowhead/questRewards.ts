/**
 * Quest reward search: joins zone quest lists with their reward items and filters them
 * by character (class, race, level, completed quests) and item criteria.
 */
import type { ZoneQuest, ZoneQuestsPage } from './pageParser.js';
import {
  buildItemInfo,
  checkUsability,
  compareItems,
  decodeMask,
  CLASS_MASK,
  RACE_MASK,
  type ItemComparison,
  type ItemInfo,
} from './itemInfo.js';

export interface QuestFilterOptions {
  faction?: 'Alliance' | 'Horde' | 'Both';
  minQuestLevel?: number;
  maxQuestLevel?: number;
  /** Hide quests whose required level is above this (usually the character's level). */
  maxRequiredLevel?: number;
  excludeQuestIds?: number[];
  className?: string;
  race?: string;
  onlyWithItemRewards?: boolean;
}

export interface ListedQuest extends ZoneQuest {
  zoneId: number;
  zoneName?: string;
  restrictedToClasses?: string[];
  restrictedToRaces?: string[];
}

function questMatches(q: ZoneQuest, opts: QuestFilterOptions, excluded: Set<number>): boolean {
  if (excluded.has(q.id)) return false;
  if (opts.faction && opts.faction !== 'Both' && q.side && q.side !== 'Both' && q.side !== opts.faction) return false;
  if (opts.minQuestLevel !== undefined && q.level !== undefined && q.level < opts.minQuestLevel) return false;
  if (opts.maxQuestLevel !== undefined && q.level !== undefined && q.level > opts.maxQuestLevel) return false;
  if (opts.maxRequiredLevel !== undefined && q.requiredLevel !== undefined && q.requiredLevel > opts.maxRequiredLevel) return false;
  if (opts.onlyWithItemRewards && !q.itemRewards && !q.itemChoices) return false;

  const classes = decodeMask(q.reqClassMask, CLASS_MASK);
  if (opts.className && classes && !classes.some((c) => c.toLowerCase() === opts.className!.toLowerCase())) return false;
  const races = decodeMask(q.reqRaceMask, RACE_MASK);
  if (opts.race && races && !races.some((r) => r.toLowerCase() === opts.race!.toLowerCase())) return false;
  return true;
}

/** Filters and flattens the quests of one or more zone pages. Quests appearing in several zones are listed once. */
export function filterZoneQuests(pages: ZoneQuestsPage[], opts: QuestFilterOptions): ListedQuest[] {
  const excluded = new Set(opts.excludeQuestIds ?? []);
  const seen = new Set<number>();
  const out: ListedQuest[] = [];
  for (const page of pages) {
    for (const q of page.quests) {
      if (seen.has(q.id) || !questMatches(q, opts, excluded)) continue;
      seen.add(q.id);
      out.push({
        ...q,
        zoneId: page.zoneId,
        zoneName: page.zoneName,
        restrictedToClasses: decodeMask(q.reqClassMask, CLASS_MASK),
        restrictedToRaces: decodeMask(q.reqRaceMask, RACE_MASK),
      });
    }
  }
  return out.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.id - b.id);
}

export interface RewardSearchOptions extends QuestFilterOptions {
  characterLevel?: number;
  itemClass?: 'weapon' | 'armor' | 'any';
  /** Subclass names to keep, matched case-insensitively against e.g. "Staff", "Dagger", "Leather". */
  subclasses?: string[];
  minDps?: number;
  includeUnusable?: boolean;
  includeTalentGated?: boolean;
}

export interface RewardCandidate {
  item: ItemInfo;
  quest: { id: number; name: string; level?: number; requiredLevel?: number; side?: string; zoneId: number; zoneName?: string };
  rewardType: 'choice' | 'guaranteed';
  usable: boolean;
  unusableReasons?: string[];
  comparison?: ItemComparison;
}

/**
 * Builds reward candidates from zone pages using the zones' `quest-rewards` item rows,
 * then applies item filters and usability checks.
 */
export function findRewardCandidates(pages: ZoneQuestsPage[], opts: RewardSearchOptions): RewardCandidate[] {
  const quests = filterZoneQuests(pages, {
    ...opts,
    maxRequiredLevel: opts.maxRequiredLevel ?? opts.characterLevel,
    onlyWithItemRewards: true,
  });

  const itemRows: Record<number, Record<string, any>> = {};
  for (const page of pages) Object.assign(itemRows, page.rewardItems);

  const wantedSubclasses = opts.subclasses?.map((s) => s.toLowerCase().trim());
  const candidates: RewardCandidate[] = [];

  for (const q of quests) {
    const entries = [
      ...(q.itemChoices ?? []).map((r) => ({ ...r, rewardType: 'choice' as const })),
      ...(q.itemRewards ?? []).map((r) => ({ ...r, rewardType: 'guaranteed' as const })),
    ];
    for (const entry of entries) {
      const row = itemRows[entry.id];
      if (!row) continue; // not equippable / not in the zone's reward item table
      const item = buildItemInfo(row);

      // Only gear: "any" means weapons and armor, never pets, bags, food or ammo
      if (item.itemClassId !== 2 && item.itemClassId !== 4) continue;
      if (opts.itemClass === 'weapon' && item.itemClassId !== 2) continue;
      if (opts.itemClass === 'armor' && item.itemClassId !== 4) continue;
      if (wantedSubclasses && !wantedSubclasses.some((s) => item.subclass?.toLowerCase().includes(s))) continue;
      if (opts.minDps !== undefined && (item.dps ?? 0) < opts.minDps) continue;

      const usability = checkUsability(item, {
        className: opts.className,
        race: opts.race,
        level: opts.characterLevel,
        includeTalentGated: opts.includeTalentGated,
      });
      if (!usability.usable && !opts.includeUnusable) continue;

      candidates.push({
        item,
        quest: {
          id: q.id,
          name: q.name,
          level: q.level,
          requiredLevel: q.requiredLevel,
          side: q.side,
          zoneId: q.zoneId,
          zoneName: q.zoneName,
        },
        rewardType: entry.rewardType,
        usable: usability.usable,
        unusableReasons: usability.usable ? undefined : usability.reasons,
      });
    }
  }

  return candidates.sort(
    (a, b) =>
      Number(b.usable) - Number(a.usable) ||
      (b.item.dps ?? 0) - (a.item.dps ?? 0) ||
      (b.item.itemLevel ?? 0) - (a.item.itemLevel ?? 0),
  );
}

/** Merges full item info (stats, restrictions) into candidates and re-checks usability with it. */
export function enrichCandidates(
  candidates: RewardCandidate[],
  infos: Map<number, ItemInfo | { error: string }>,
  opts: RewardSearchOptions,
  current?: ItemInfo,
): RewardCandidate[] {
  return candidates.map((c) => {
    const info = infos.get(c.item.id);
    const item = info && !('error' in info) ? info : c.item;
    const usability = checkUsability(item, {
      className: opts.className,
      race: opts.race,
      level: opts.characterLevel,
      includeTalentGated: opts.includeTalentGated,
    });
    return {
      ...c,
      item,
      usable: usability.usable,
      unusableReasons: usability.usable ? undefined : usability.reasons,
      comparison: current ? compareItems(item, current) : undefined,
    };
  });
}
