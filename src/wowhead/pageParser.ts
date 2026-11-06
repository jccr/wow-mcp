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

export interface ItemSourcesResult {
  itemId?: number;
  droppedBy?: WowheadNpcSource[];
  skinnedFrom?: WowheadNpcSource[];
  minedFromObject?: WowheadNpcSource[];
  gatheredFromObject?: WowheadNpcSource[];
  containedInObject?: WowheadNpcSource[];
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
 * Extracts all `new Listview({ id: '...', data: [...] })` JSON payloads from page text or HTML.
 */
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
  const containedInObject = listviews['contained-in-object']?.map(normalizeNpcRow);

  return {
    droppedBy,
    skinnedFrom,
    minedFromObject,
    gatheredFromObject,
    containedInObject,
    rawListviewsFound: foundKeys,
  };
}
