import { z } from 'zod';
import { regionEnum, type Region } from '../../config/regions.js';

// ── Namespace types ────────────────────────────────────

export type NamespaceType = 'static' | 'dynamic' | 'profile';

/**
 * Which World of Warcraft game version to query.
 * - retail:  Modern WoW            → `{type}-{region}`         (e.g. static-us)
 * - classic: WoW Classic           → `{type}-classic-{region}` (e.g. static-classic-us)
 * - forever: World of Warcraft: Forever → `{type}-forever-{region}` (e.g. static-forever-us)
 *
 * Blizzard has not officially documented the Forever namespaces yet. If the
 * unversioned name is rejected, pass a full `namespace` override instead
 * (e.g. "static-1.60.1_70399-forever-us").
 */
export const gameEnum = z.enum(['retail', 'classic', 'forever']);
export type GameFlavor = z.infer<typeof gameEnum>;

export function resolveNamespace(
  type: NamespaceType,
  region: Region,
  game: GameFlavor = 'retail',
  override?: string,
): string {
  if (override) return override;
  return game === 'retail' ? `${type}-${region}` : `${type}-${game}-${region}`;
}

/**
 * Tool groups (the part after `wow_`) that exist only in retail WoW.
 * Calls with game != "retail" are rejected with a clear error instead of an
 * opaque 404 from Blizzard.
 */
const RETAIL_ONLY_GROUPS = new Set([
  'azeriteEssence', 'conduit', 'covenant', 'soulbind',
  'decor', 'fixture', 'fixtureHook', 'neighborhood', 'neighborhoodMap', 'room',
  'heirloom', 'keystoneAffix', 'mythicKeystone', 'mythicKeystoneDungeon',
  'mythicKeystoneLeaderboard', 'mythicKeystonePeriod', 'mythicKeystoneSeason',
  'mythicRaidLeaderboard', 'techTalent', 'techTalentTree',
  'modifiedCrafting', 'modifiedCraftingCategory', 'modifiedCraftingReagentSlotType',
]);
const RETAIL_ONLY_TOOLS = new Set([
  'wow_character_decorCollection', 'wow_character_heirloomsCollection',
  'wow_character_house', 'wow_character_mythicKeystoneProfile',
  'wow_character_mythicKeystoneSeason', 'wow_character_soulbinds',
]);

export function isRetailOnly(toolName: string): boolean {
  return RETAIL_ONLY_TOOLS.has(toolName) || RETAIL_ONLY_GROUPS.has(toolName.split('_')[1] ?? '');
}

// ── Endpoint definition ────────────────────────────────

export interface EndpointDef {
  /** MCP tool name (e.g. "wow_achievement_get"). */
  toolName: string;
  /** Short human-readable title. */
  title: string;
  /** MCP tool description. */
  description: string;
  /** URL path template. No leading slash. Use {param} for path params. */
  path: string;
  /** Which Blizzard namespace to use. */
  namespace: NamespaceType;
  /** Zod schemas for tool input parameters (path params + any extras). */
  inputSchema: Record<string, z.ZodType>;
  /** If true, an extra optional `searchQuery` param is added for arbitrary query params. */
  isSearch?: boolean;
}

// ── Path builder ───────────────────────────────────────

/**
 * Replace `{param}` placeholders in a path template with actual values.
 * String values are lowercased and URI-encoded (Blizzard requires lowercase paths).
 */
export function buildPath(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    if (val == null) throw new Error(`Missing required path parameter: ${key}`);
    const str = typeof val === 'string' ? val.toLowerCase() : String(val);
    return encodeURIComponent(str);
  });
}

// ── Schema helpers ─────────────────────────────────────

/** Positive integer ID param. */
export const id = (desc: string) => z.number().int().positive().describe(desc);
/** Non-empty string slug param. */
export const slug = (desc: string) => z.string().min(1).describe(desc);

/** Region param — injected into every tool automatically. */
export const regionSchema = regionEnum
  .default('us')
  .describe('API region: "us", "eu", "kr", or "tw" (default: "us")');

/** Game version param — injected into every tool automatically. */
export const gameSchema = gameEnum
  .default('retail')
  .describe(
    'Game version: "retail" (Modern WoW, default), "classic" (WoW Classic), or "forever" (World of Warcraft: Forever)',
  );

/** Optional full namespace override — injected into every tool automatically. */
export const namespaceOverrideSchema = z
  .string()
  .regex(/^[a-z0-9._-]+$/)
  .optional()
  .describe(
    'Advanced: full Blizzard namespace to use instead of the one derived from game + region (e.g. "static-1.60.1_70399-forever-us"). Use when the default namespace returns 403/404.',
  );

/** Locale param — injected into every tool automatically. */
export const localeSchema = z
  .string()
  .default('en_US')
  .describe('Response locale (e.g. "en_US", "es_MX", "pt_BR", "de_DE", "fr_FR", "ko_KR"). Default: "en_US"');

/** Shared character input params. */
export const characterParams = {
  realmSlug: slug('Realm slug (lowercase, hyphenated). Example: "tichondrius", "area-52"'),
  characterName: slug('Character name (case-insensitive)'),
};

/** Shared guild input params. */
export const guildParams = {
  realmSlug: slug('Realm slug (lowercase, hyphenated)'),
  nameSlug: slug('Guild name slug (lowercase, hyphenated)'),
};
