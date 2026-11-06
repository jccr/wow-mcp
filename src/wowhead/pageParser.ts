/**
 * Parser for Wowhead's embedded ListView data structures.
 *
 * Wowhead encodes its rich relation tables (Dropped by, Skinned from, Vendored by, etc.)
 * inside client-side JavaScript calls on the item page:
 *   new Listview({ id: 'dropped-by', data: [ ... ] })
 *   new Listview({ id: 'skinned-from', data: [ ... ] })
 */

export interface WowheadNpcSource {
  id: number;
  name: string;
  classification?: number; // 0 = Normal, 1 = Elite, 2 = Rare Elite, 3 = Boss, 4 = Rare
  classificationName?: string;
  level?: [number, number] | number;
  minLevel?: number;
  maxLevel?: number;
  location?: number[];
  count?: number;
  outOf?: number;
  dropRatePercent?: number;
}

export interface WowheadVendorSource {
  id: number;
  name: string;
  tag?: string; // e.g. "Weapons Merchant"
  cost?: number; // In copper
  costFormatted?: string;
  stock?: number;
  location?: number[];
  react?: [number, number]; // [Alliance, Horde] reaction: 1 = friendly, -1 = hostile
}

export interface WowheadCraftingSource {
  id: number;
  name: string;
  skillId?: number;
  skillName?: string;
  skillLevel?: number;
  sourceType?: string;
}

export interface WowheadQuestSource {
  id: number;
  name: string;
  reqLevel?: number;
  level?: number;
  side?: number;
  sideName?: string;
}

export interface WowheadReagentForSource {
  id: number;
  name: string;
  skillId?: number;
  skillName?: string;
  skillLevel?: number;
  category?: number;
  reagents?: [number, number][]; // [itemId, count]
}

export interface WowheadContainerSource {
  id: number;
  name: string;
  type?: string;
  quality?: number;
  level?: number;
  slots?: number;
}

export interface WowheadSeeAlsoItem {
  id: number;
  name: string;
  quality?: number;
  level?: number;
  description?: string;
}

export interface WowheadComment {
  id: number;
  date?: string;
  rating?: number;
  user?: string;
  body: string;
  replies?: WowheadComment[];
}

export interface ItemSourcesResult {
  itemId?: number;
  droppedBy?: WowheadNpcSource[];
  skinnedFrom?: WowheadNpcSource[];
  containedInObject?: WowheadNpcSource[];
  minedFromObject?: WowheadNpcSource[];
  gatheredFromObject?: WowheadNpcSource[];
  soldBy?: WowheadVendorSource[];
  rewardFromQuests?: WowheadQuestSource[];
  craftedBy?: WowheadCraftingSource[];
  reagentFor?: WowheadReagentForSource[];
  canBePlacedIn?: WowheadContainerSource[];
  seeAlso?: WowheadSeeAlsoItem[];
  comments?: WowheadComment[];
  rawListviewsFound: string[];
}

const CLASSIFICATION_MAP: Record<number, string> = {
  0: 'Normal',
  1: 'Elite',
  2: 'Rare Elite',
  3: 'Boss',
  4: 'Rare',
};

/**
 * Normalizes raw ListView rows into clean NPC / Creature source records.
 */
function formatCopperMoney(copper?: number): string | undefined {
  if (copper === undefined || copper === null) return undefined;
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  const parts: string[] = [];
  if (g > 0) parts.push(`${g}g`);
  if (s > 0) parts.push(`${s}s`);
  if (c > 0 || parts.length === 0) parts.push(`${c}c`);
  return parts.join(' ');
}

/**
 * Wowhead sold-by rows encode cost as `[[copper], [currencies], [items]]` (e.g. `[[3181]]`),
 * older payloads as a plain number.
 */
function extractCopperCost(cost: unknown): number | undefined {
  if (typeof cost === 'number') return cost;
  if (Array.isArray(cost)) {
    const first = cost[0];
    if (typeof first === 'number') return first;
    if (Array.isArray(first) && typeof first[0] === 'number') return first[0];
  }
  return undefined;
}

function normalizeVendorRow(row: Record<string, any>): WowheadVendorSource {
  const cost = extractCopperCost(row.cost);
  return {
    id: row.id,
    name: row.name ?? `Vendor #${row.id}`,
    tag: typeof row.tag === 'string' ? row.tag : undefined,
    cost,
    costFormatted: formatCopperMoney(cost),
    // -1 means unlimited stock
    stock: typeof row.stock === 'number' && row.stock >= 0 ? row.stock : undefined,
    location: Array.isArray(row.location) ? row.location : undefined,
    react: Array.isArray(row.react) ? [row.react[0], row.react[1]] : undefined,
  };
}

function normalizeQuestRow(row: Record<string, any>): WowheadQuestSource {
  const side = typeof row.side === 'number' ? row.side : undefined;
  const sideName = side === 1 ? 'Alliance' : side === 2 ? 'Horde' : side === 3 ? 'Both' : undefined;
  return {
    id: row.id,
    name: row.name ?? `Quest #${row.id}`,
    reqLevel: row.reqlevel,
    level: row.level,
    side,
    sideName,
  };
}

function normalizeCraftingRow(row: Record<string, any>): WowheadCraftingSource {
  return {
    id: row.id,
    name: row.name ?? `Recipe #${row.id}`,
    skillId: row.skill,
    skillName: row.skillname,
    skillLevel: row.learnedat ?? row.colors?.[0],
    sourceType: row.sourcemore?.[0]?.n ?? row.sourcename,
  };
}

function normalizeReagentForRow(row: Record<string, any>): WowheadReagentForSource {
  return {
    id: row.id,
    name: row.name ?? `Spell #${row.id}`,
    skillId: row.skill,
    skillName: row.skillname,
    skillLevel: row.learnedat ?? row.colors?.[0],
    category: row.category,
    reagents: Array.isArray(row.reagents) ? row.reagents : undefined,
  };
}

function normalizeContainerRow(row: Record<string, any>): WowheadContainerSource {
  return {
    id: row.id,
    name: row.name ?? `Container #${row.id}`,
    type: row.type,
    quality: row.quality,
    level: row.level,
    slots: row.slots,
  };
}

function normalizeSeeAlsoRow(row: Record<string, any>): WowheadSeeAlsoItem {
  return {
    id: row.id,
    name: row.name ?? `Item #${row.id}`,
    quality: row.quality,
    level: row.level,
    description: row.description,
  };
}
function normalizeNpcRow(row: Record<string, any>): WowheadNpcSource {
  const minLvl = Array.isArray(row.level) ? row.level[0] : row.minlevel ?? row.level;
  const maxLvl = Array.isArray(row.level) ? row.level[1] : row.maxlevel ?? row.level;
  const classification = typeof row.classification === 'number' ? row.classification : 0;

  let dropRatePercent: number | undefined;
  if (typeof row.percent === 'number') {
    dropRatePercent = row.percent;
  } else if (typeof row.count === 'number' && typeof row.outof === 'number' && row.outof > 0) {
    dropRatePercent = Number(((row.count / row.outof) * 100).toFixed(2));
  }

  return {
    id: row.id,
    name: row.name ?? `NPC #${row.id}`,
    classification,
    classificationName: CLASSIFICATION_MAP[classification] ?? 'Normal',
    minLevel: minLvl,
    maxLevel: maxLvl,
    location: Array.isArray(row.location) ? row.location : undefined,
    count: row.count,
    outOf: row.outof,
    dropRatePercent,
  };
}

/**
 * Extracts community comments (e.g. lv_comments0 = [ ... ] or var lv_comments = [ ... ]).
 */
export function extractCommentsFromHtml(html: string): WowheadComment[] {
  const comments: WowheadComment[] = [];

  // Match: lv_comments[0-9]*\s*=\s*(\[[\s\S]*?\]);
  const commentVarRegex = /(?:var\s+)?lv_comments\w*\s*=\s*/g;
  let match: RegExpExecArray | null;

  while ((match = commentVarRegex.exec(html)) !== null) {
    const startIdx = match.index + match[0].length;
    if (html[startIdx] !== '[') continue;

    let depth = 0;
    let inString: string | null = null;
    let endIdx = -1;

    for (let i = startIdx; i < html.length; i++) {
      const char = html[i];
      const prev = html[i - 1];

      if (inString) {
        if (char === inString && prev !== '\\') {
          inString = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = char;
      } else if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    if (endIdx === -1) continue;

    const rawArray = html.slice(startIdx, endIdx);
    try {
      let parsed: any[];
      try {
        parsed = JSON.parse(rawArray);
      } catch {
        parsed = Function(`"use strict"; return (${rawArray});`)();
      }

      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          const rawBody = c.body ?? c.comment ?? '';
          // Strip inner HTML / bbcode tags for clean readable text
          const cleanBody = rawBody
            .replace(/<[^>]+>/g, '')
            .replace(/\[\/?(?:b|i|u|url|item|spell|color)[^\]]*\]/gi, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .trim();

          const replies: WowheadComment[] = Array.isArray(c.replies)
            ? c.replies.map((r: any) => ({
                id: r.id,
                date: r.date,
                rating: r.rating,
                user: r.user,
                body: (r.body ?? '').replace(/<[^>]+>/g, '').trim(),
              }))
            : undefined;

          comments.push({
            id: c.id,
            date: c.date,
            rating: c.rating,
            user: c.user,
            body: cleanBody,
            replies,
          });
        }
      }
    } catch {
      // Ignore unparseable blocks
    }
  }

  // Sort by rating descending (highest community upvotes first)
  return comments.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
export function extractListviewsFromHtml(html: string): Record<string, any[]> {
  const result: Record<string, any[]> = {};

  // Matches pattern: new Listview({ id: 'dropped-by', ... data: [...] })
  // Handles variations in spacing and keys
  const listviewRegex = /new\s+Listview\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;/gi;

  let match: RegExpExecArray | null;
  while ((match = listviewRegex.exec(html)) !== null) {
    const block = match[1];

    // Extract ListView ID
    const idMatch = block.match(/id\s*:\s*['"]([^'"]+)['"]/);
    if (!idMatch) continue;
    const listviewId = idMatch[1];

    // Extract the raw array passed to data: [ ... ]
    const dataIdx = block.indexOf('data:');
    if (dataIdx === -1) continue;

    // Find array boundaries
    const arrayStart = block.indexOf('[', dataIdx);
    if (arrayStart === -1) continue;

    let depth = 0;
    let inString: string | null = null;
    let arrayEnd = -1;

    for (let i = arrayStart; i < block.length; i++) {
      const char = block[i];
      const prev = block[i - 1];

      if (inString) {
        if (char === inString && prev !== '\\') {
          inString = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = char;
      } else if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          arrayEnd = i + 1;
          break;
        }
      }
    }

    if (arrayEnd === -1) continue;

    const rawDataJson = block.slice(arrayStart, arrayEnd);
    try {
      // Wowhead JS often uses valid JSON inside data, but sometimes has unquoted keys
      // Try strict JSON parse first, fallback to relaxed parser
      let parsed: any[];
      try {
        parsed = JSON.parse(rawDataJson);
      } catch {
        // Safe evaluation of pure JSON-like array literal
        parsed = Function(`"use strict"; return (${rawDataJson});`)();
      }

      if (Array.isArray(parsed)) {
        result[listviewId] = parsed;
      }
    } catch {
      // Skip unparseable block
    }
  }

  return result;
}

/**
 * Parses full page HTML or JS content and produces a structured ItemSourcesResult
 * focusing on 'dropped-by', 'skinned-from', and gathering tables.
 */
export function parseItemSources(html: string): ItemSourcesResult {
  const listviews = extractListviewsFromHtml(html);
  const foundKeys = Object.keys(listviews);

  const droppedBy = listviews['dropped-by']
    ?.filter((row) => (row.count === undefined || row.count >= 0) && (row.percent === undefined || row.percent >= 0))
    .map(normalizeNpcRow);
  const skinnedFrom = listviews['skinned-from']
    ?.filter((row) => (row.count === undefined || row.count >= 0) && (row.percent === undefined || row.percent >= 0))
    .map(normalizeNpcRow);
  const minedFromObject = listviews['mined-from-object']
    ?.filter((row) => (row.count === undefined || row.count >= 0) && (row.percent === undefined || row.percent >= 0))
    .map(normalizeNpcRow);
  const gatheredFromObject = listviews['gathered-from-object']
    ?.filter((row) => (row.count === undefined || row.count >= 0) && (row.percent === undefined || row.percent >= 0))
    .map(normalizeNpcRow);
  const containedInObject = (listviews['contained-in-object'] ?? listviews['contained-in-item'] ?? listviews['contained-in'])
    ?.filter((row) => (row.count === undefined || row.count >= 0) && (row.percent === undefined || row.percent >= 0))
    .map(normalizeNpcRow);
  const soldBy = (listviews['sold-by'] ?? listviews['vendors'])?.map(normalizeVendorRow);
  const rewardFromQuests = (
    listviews['reward-from-q'] ??
    listviews['reward-from-quests'] ??
    listviews['reward-of-quest'] ??
    listviews['reward-from']
  )?.map(normalizeQuestRow);
  const craftedBy = (listviews['crafted-by'] ?? listviews['created-by'])?.map(normalizeCraftingRow);
  const reagentFor = (listviews['reagent-for'] ?? listviews['used-in-recipe'])?.map(normalizeReagentForRow);
  const canBePlacedIn = (listviews['can-be-placed-in'] ?? listviews['placed-in'])?.map(normalizeContainerRow);
  const seeAlso = (listviews['see-also'] ?? listviews['same-model-as'])?.map(normalizeSeeAlsoRow);

  const comments = extractCommentsFromHtml(html);

  return {
    droppedBy,
    skinnedFrom,
    minedFromObject,
    gatheredFromObject,
    containedInObject,
    soldBy,
    rewardFromQuests,
    craftedBy,
    reagentFor,
    canBePlacedIn,
    seeAlso,
    comments: comments.length > 0 ? comments : undefined,
    rawListviewsFound: foundKeys,
  };
}

/**
 * Parses Wowhead's official unblocked XML payload (`/item={id}&xml`).
 * Extracts real structured sources: droppedBy, soldBy, rewardFromQuests, craftedBy.
 */
export function parseItemXml(xml: string, itemId: number): ItemSourcesResult {
  const result: ItemSourcesResult = {
    itemId,
    rawListviewsFound: [],
  };

  const jsonMatch = xml.match(/<json><!\[CDATA\[([\s\S]*?)\]\]><\/json>/);
  if (!jsonMatch) return result;

  let data: Record<string, any>;
  try {
    const raw = jsonMatch[1].trim();
    const wrapped = raw.startsWith('{') ? raw : `{${raw}}`;
    data = JSON.parse(wrapped);
  } catch {
    return result;
  }

  // Check htmlTooltip for exact inline drop chance if present
  let dropChancePercent: number | undefined;
  const tooltipMatch = xml.match(/<htmlTooltip><!\[CDATA\[([\s\S]*?)\]\]><\/htmlTooltip>/);
  if (tooltipMatch) {
    const chanceMatch = tooltipMatch[1].match(/Drop Chance:\s*([0-9.]+)%/i);
    if (chanceMatch) {
      dropChancePercent = parseFloat(chanceMatch[1]);
    }
  }

  const sources: number[] = Array.isArray(data.source) ? data.source : [];
  const sourcemore: Array<{ n?: string; t?: number; ti?: number; z?: number }> = Array.isArray(data.sourcemore)
    ? data.sourcemore
    : [];

  // Source Types in Wowhead data model:
  // 1 = Crafted, 2 = Drop, 3 = PvP, 4 = Quest, 5 = Vendor
  for (const s of sources) {
    if (s === 2) {
      // Drop
      const drops: WowheadNpcSource[] = sourcemore
        .filter((sm) => sm.t === 1 && sm.ti)
        .map((sm) => ({
          id: sm.ti!,
          name: sm.n ?? `NPC #${sm.ti}`,
          location: sm.z ? [sm.z] : undefined,
          dropRatePercent: dropChancePercent,
        }));

      if (drops.length > 0) {
        result.droppedBy = drops;
        result.rawListviewsFound.push('dropped-by');
      }
    } else if (s === 5) {
      // Vendor
      const vendors: WowheadVendorSource[] = sourcemore
        .filter((sm) => (sm.t === 1 || !sm.t) && sm.ti)
        .map((sm) => ({
          id: sm.ti!,
          name: sm.n ?? `Vendor #${sm.ti}`,
          location: sm.z ? [sm.z] : undefined,
        }));

      if (vendors.length > 0) {
        result.soldBy = vendors;
        result.rawListviewsFound.push('sold-by');
      }
    } else if (s === 4) {
      // Quest reward
      const quests: WowheadQuestSource[] = sourcemore
        .filter((sm) => sm.t === 5 && sm.ti)
        .map((sm) => ({
          id: sm.ti!,
          name: sm.n ?? `Quest #${sm.ti}`,
        }));

      if (quests.length > 0) {
        result.rewardFromQuests = quests;
        result.rawListviewsFound.push('reward-from-quests');
      }
    } else if (s === 1) {
      // Crafted
      const crafted: WowheadCraftingSource[] = sourcemore
        .filter((sm) => sm.ti)
        .map((sm) => ({
          id: sm.ti!,
          name: sm.n ?? `Recipe #${sm.ti}`,
        }));

      if (crafted.length > 0) {
        result.craftedBy = crafted;
        result.rawListviewsFound.push('crafted-by');
      }
    }
  }

  return result;
}

export interface QuestChainStep {
  position: number;
  questId?: number; // absent for the current quest (rendered without a link)
  name: string;
  current: boolean;
}

export interface QuestInfo {
  level?: number;
  requiredLevel?: number;
  side?: string;
  startNpc?: { id: number; name: string };
  endNpc?: { id: number; name: string };
  sharable?: boolean;
}

export interface QuestPageDetails {
  questId: number;
  /** False when the HTML is not a real quest page (e.g. a WAF challenge body). */
  isQuestPage: boolean;
  items?: Array<{ id: number; name: string; choice?: boolean }>;
  experience?: number;
  moneyCopper?: number;
  reputations?: Array<{ factionId: number; factionName: string; amount: number }>;
  info?: QuestInfo;
  chain?: {
    steps: QuestChainStep[];
    previousQuestId?: number;
    nextQuestId?: number;
    finalQuestId?: number;
  };
}

/** Parses the quest series table (`<table class="series">`). */
export function parseQuestChain(html: string, questId: number): QuestPageDetails['chain'] {
  const tableMatch = html.match(/<table class="series">([\s\S]*?)<\/table>/);
  if (!tableMatch) return undefined;

  const steps: QuestChainStep[] = [];
  const rowRegex = /<tr><th>(\d+)\.<\/th><td>([\s\S]*?)<\/td><\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(tableMatch[1])) !== null) {
    const position = Number(m[1]);
    const cell = m[2];
    const link = cell.match(/\/quest=(\d+)[^"]*">([^<]+)<\/a>/);
    if (link) {
      const id = Number(link[1]);
      steps.push({ position, questId: id, name: link[2], current: id === questId });
    } else {
      const bold = cell.match(/<b>([^<]+)<\/b>/);
      steps.push({ position, questId, name: bold?.[1] ?? '', current: true });
    }
  }
  if (steps.length === 0) return undefined;

  const idx = steps.findIndex((s) => s.current);
  const last = steps[steps.length - 1];
  return {
    steps,
    previousQuestId: idx > 0 ? steps[idx - 1].questId : undefined,
    nextQuestId: idx >= 0 && idx < steps.length - 1 ? steps[idx + 1].questId : undefined,
    finalQuestId: last.questId,
  };
}

/** Parses the quest infobox markup (`WH.markup.printHtml("[ul][li]Level: 16[/li]...")`). */
export function parseQuestInfobox(html: string): QuestInfo | undefined {
  const match = html.match(/WH\.markup\.printHtml\("(\[ul\][\s\S]*?)",\s*"infobox-contents/);
  if (!match) return undefined;
  const markup = match[1].replace(/\\\//g, '/').replace(/\\"/g, '"');

  const info: QuestInfo = {};
  const level = markup.match(/\[li\]Level: (\d+)\[\/li\]/);
  if (level) info.level = Number(level[1]);
  const req = markup.match(/\[li\]Requires level (\d+)\[\/li\]/);
  if (req) info.requiredLevel = Number(req[1]);
  const side = markup.match(/\[li\]Side: (?:\[span[^\]]*\])?([^[]+)/);
  if (side) info.side = side[1].trim();
  const start = markup.match(/Start: \[url=\/[^\]]*npc=(\d+)[^\]]*\]([^[]+)\[\/url\]/);
  if (start) info.startNpc = { id: Number(start[1]), name: start[2] };
  const end = markup.match(/End: \[url=\/[^\]]*npc=(\d+)[^\]]*\]([^[]+)\[\/url\]/);
  if (end) info.endNpc = { id: Number(end[1]), name: end[2] };
  if (markup.includes('[li]Sharable[/li]')) info.sharable = true;
  else if (markup.includes('[li]Not sharable[/li]')) info.sharable = false;

  return Object.keys(info).length > 0 ? info : undefined;
}

/**
 * Parses full HTML or page content for a Wowhead Quest page (/quest={id})
 * to extract reward items, XP, money, reputation, infobox details and the quest chain.
 */
export function parseQuestPage(html: string, questId: number): QuestPageDetails {
  const isQuestPage = /g_pageInfo\s*=\s*\{"type":5\b/.test(html) || html.includes('Rewards</h2>') || html.includes('class="series"');
  const result: QuestPageDetails = { questId, isQuestPage };
  result.info = parseQuestInfobox(html);
  result.chain = parseQuestChain(html, questId);

  // Quests that only grant XP/reputation have a "Gains" section but no "Rewards" heading
  const rewardsIdx = html.indexOf('Rewards</h2>');
  const start = rewardsIdx !== -1 ? rewardsIdx : html.indexOf('Gains</h2>');
  if (start === -1) {
    return result;
  }

  const end = html.indexOf("See if you've already completed this", start);
  const rewardsHtml = html.substring(start, end !== -1 ? end : start + 3000);

  const isChoice = rewardsHtml.includes('choose one of these rewards');

  // Parse rewarded items from icontab tables or item links
  const itemRegex = /href="\/forever\/item=(\d+)(?:\/[^"]*)?"[^>]*>([^<]+)<\/a>/g;
  const items: Array<{ id: number; name: string; choice?: boolean }> = [];
  let m: RegExpExecArray | null;
  const seenItems = new Set<number>();
  while ((m = itemRegex.exec(rewardsHtml)) !== null) {
    const id = Number(m[1]);
    if (seenItems.has(id)) continue;
    seenItems.add(id);
    items.push({ id, name: m[2], choice: isChoice });
  }
  if (items.length > 0) {
    result.items = items;
  }

  // Money: WH.Wow.Quest.setupScalingRewards({ ... "coin":{"rewardAtCap":0,"multiplier":1,"levels":{"16":800}} })
  const coinMatch = rewardsHtml.match(/"coin":\{[^}]*"levels":\{"\d+":(\d+)\}/);
  if (coinMatch) {
    result.moneyCopper = Number(coinMatch[1]);
  }

  // XP: "xp":{"multiplier":...,"levels":{"16":1150}}
  const xpMatch = rewardsHtml.match(/"xp":\{[^}]*"levels":\{"\d+":(\d+)\}/);
  if (xpMatch) {
    result.experience = Number(xpMatch[1]);
  }

  // Reputation: <span>100</span> reputation with <a href="/forever/faction=76/orgrimmar">Orgrimmar</a>
  const repRegex = /<span>(\d+)<\/span>\s*reputation with\s*<a href="[^"]*\/faction=(\d+)[^"]*">([^<]+)<\/a>/g;
  const reputations: Array<{ factionId: number; factionName: string; amount: number }> = [];
  while ((m = repRegex.exec(rewardsHtml)) !== null) {
    reputations.push({ amount: Number(m[1]), factionId: Number(m[2]), factionName: m[3] });
  }
  if (reputations.length > 0) {
    result.reputations = reputations;
  }

  return result;
}

const SIDE_NAMES: Record<number, string> = { 1: 'Alliance', 2: 'Horde', 3: 'Both' };

export interface ZoneQuest {
  id: number;
  name: string;
  level?: number;
  requiredLevel?: number;
  side?: string;
  experience?: number;
  moneyCopper?: number;
  /** Items always granted: [itemId, count]. */
  itemRewards?: Array<{ id: number; count: number }>;
  /** Pick-one choice items: [itemId, count]. */
  itemChoices?: Array<{ id: number; count: number }>;
  reputations?: Array<{ factionId: number; amount: number }>;
  reqClassMask?: number;
  reqRaceMask?: number;
}

export interface ZoneQuestsPage {
  zoneId: number;
  zoneName?: string;
  isZonePage: boolean;
  quests: ZoneQuest[];
  /** Raw `quest-rewards` listview rows keyed by item id (type, subclass, dps, armor, reqlevel, reqrace). */
  rewardItems: Record<number, Record<string, any>>;
}

function toPairs(value: unknown): Array<{ id: number; count: number }> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const pairs = value
    .filter((p): p is [number, number] => Array.isArray(p) && typeof p[0] === 'number')
    .map(([id, count]) => ({ id, count: typeof count === 'number' ? count : 1 }));
  return pairs.length > 0 ? pairs : undefined;
}

/** Parses a Wowhead zone page (/zone={id}) for its `quests` and `quest-rewards` listviews. */
export function parseZoneQuests(html: string, zoneId: number): ZoneQuestsPage {
  const pageInfo = html.match(/g_pageInfo\s*=\s*(\{[^}]*\})/);
  let zoneName: string | undefined;
  let isZonePage = false;
  if (pageInfo) {
    try {
      const info = JSON.parse(pageInfo[1]);
      isZonePage = info.type === 7;
      zoneName = info.name;
    } catch {
      // ignore malformed page info
    }
  }

  const listviews = extractListviewsFromHtml(html);
  if (listviews['quests']) isZonePage = true;

  const quests: ZoneQuest[] = (listviews['quests'] ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? `Quest #${row.id}`,
    level: typeof row.level === 'number' && row.level > 0 ? row.level : undefined,
    requiredLevel: typeof row.reqlevel === 'number' ? row.reqlevel : undefined,
    side: typeof row.side === 'number' ? SIDE_NAMES[row.side] : undefined,
    experience: typeof row.xp === 'number' ? row.xp : undefined,
    moneyCopper: typeof row.money === 'number' && row.money > 0 ? row.money : undefined,
    itemRewards: toPairs(row.itemrewards),
    itemChoices: toPairs(row.itemchoices),
    reputations: toPairs(row.reprewards)?.map((p) => ({ factionId: p.id, amount: p.count })),
    reqClassMask: typeof row.reqclass === 'number' && row.reqclass > 0 ? row.reqclass : undefined,
    reqRaceMask: typeof row.reqrace === 'number' && row.reqrace > 0 ? row.reqrace : undefined,
  }));

  const rewardItems: Record<number, Record<string, any>> = {};
  for (const row of listviews['quest-rewards'] ?? []) {
    if (typeof row.id === 'number') rewardItems[row.id] = row;
  }

  return { zoneId, zoneName, isZonePage, quests, rewardItems };
}
