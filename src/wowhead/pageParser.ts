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

function normalizeVendorRow(row: Record<string, any>): WowheadVendorSource {
  const cost = typeof row.cost === 'number' ? row.cost : typeof row.avail === 'number' ? row.avail : undefined;
  return {
    id: row.id,
    name: row.name ?? `Vendor #${row.id}`,
    cost,
    costFormatted: formatCopperMoney(cost),
    stock: typeof row.stock === 'number' ? row.stock : undefined,
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

  const droppedBy = listviews['dropped-by']?.map(normalizeNpcRow);
  const skinnedFrom = listviews['skinned-from']?.map(normalizeNpcRow);
  const minedFromObject = listviews['mined-from-object']?.map(normalizeNpcRow);
  const gatheredFromObject = listviews['gathered-from-object']?.map(normalizeNpcRow);
  const containedInObject = (listviews['contained-in-object'] ?? listviews['contained-in-item'] ?? listviews['contained-in'])?.map(normalizeNpcRow);
  const soldBy = (listviews['sold-by'] ?? listviews['vendors'])?.map(normalizeVendorRow);
  const rewardFromQuests = (listviews['reward-of-quest'] ?? listviews['reward-from-quests'])?.map(normalizeQuestRow);
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
        .filter((sm) => sm.t === 1 && sm.ti)
        .map((sm) => ({
          id: sm.ti!,
          name: sm.n ?? `Vendor #${sm.ti}`,
          location: sm.z ? [sm.z] : undefined,
        }));

      if (vendors.length > 0) {
        result.soldBy = vendors;
        result.rawListviewsFound.push('sold-by');
      } else {
        // Sold by vendors without specific sourcemore entry (e.g. standard weapon vendors)
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
