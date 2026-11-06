import got, { type Got } from 'got';
import * as fs from 'fs';
import * as path from 'path';
import {
  type WowheadSuggestionsResponse,
  type WowheadTooltipResponse,
  type SearchResultItem,
  type WowheadEntityDetails,
} from './types.js';
import { formatTooltip, getQualityName } from './formatter.js';
import {
  parseItemSources,
  parseItemXml,
  parseQuestPage,
  parseZoneQuests,
  type ItemSourcesResult,
  type QuestPageDetails,
  type ZoneQuestsPage,
} from './pageParser.js';
import { parseItemXmlInfo, type ItemInfo } from './itemInfo.js';
import { logger } from '../util/logger.js';

export const WOWHEAD_FOREVER_DATA_ENV = 16;
export const DEFAULT_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface WowheadClientOptions {
  userAgent?: string;
  cacheTtlMs?: number;
  cookie?: string;
  pagesDataDir?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function normalizeEntityType(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === 'items') return 'item';
  if (t === 'spells') return 'spell';
  if (t === 'quests') return 'quest';
  if (t === 'npcs') return 'npc';
  if (t === 'objects') return 'object';
  if (t === 'zones') return 'zone';
  if (t === 'itemset' || t === 'item_set' || t === 'item-sets' || t === 'itemsets') return 'item-set';
  return t;
}

export class WowheadForeverClient {
  private http: Got;
  private readonly userAgent: string;
  private readonly cacheTtlMs: number;
  private readonly pagesDataDir: string;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private currentCookie?: string;

  constructor(options: WowheadClientOptions = {}) {
    this.userAgent =
      options.userAgent ??
      process.env['WOWHEAD_USER_AGENT'] ??
      DEFAULT_CHROME_UA;
    this.cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000; // 10 minutes default
    this.pagesDataDir =
      options.pagesDataDir ??
      process.env['WOWHEAD_PAGES_DIR'] ??
      path.resolve(process.cwd(), 'data', 'pages');

    const cookie = options.cookie ?? process.env['WOWHEAD_COOKIE'];
    this.currentCookie = cookie;

    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    };

    if (cookie) {
      headers['cookie'] = cookie;
    }

    this.http = got.extend({
      headers,
      timeout: {
        request: 10000,
      },
      retry: {
        limit: 2,
      },
    });
  }

  public setCookie(cookie: string): void {
    const trimmed = cookie.trim();
    const formatted = trimmed.startsWith('aws-waf-token=') ? trimmed : `aws-waf-token=${trimmed}`;
    this.currentCookie = formatted;

    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      cookie: formatted,
    };

    this.http = got.extend({
      headers,
      timeout: { request: 10000 },
      retry: { limit: 2 },
    });
  }

  public getCookie(): string | undefined {
    return this.currentCookie;
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private setCached<T>(key: string, value: T): void {
    // Keep cache bounded
    if (this.cache.size > 2000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  public getWebUrl(type: string, id: number): string {
    const norm = normalizeEntityType(type);
    if (norm === 'guide') {
      return `https://www.wowhead.com/forever/guide=${id}`;
    }
    return `https://www.wowhead.com/forever/${norm}=${id}`;
  }

  /**
   * Search and retrieve official Wowhead class and spec guides for WoW: Forever.
   */
  public async getGuides(
    options: {
      className?: string;
      specName?: string;
      guideType?: 'overview' | 'leveling' | 'talents' | 'gear' | 'rotation' | 'all';
      query?: string;
      limit?: number;
    } = {}
  ): Promise<import('./types.js').WowheadClassGuideItem[]> {
    const terms: string[] = [];
    if (options.className) terms.push(options.className);
    if (options.specName) terms.push(options.specName);
    if (options.guideType && options.guideType !== 'all') terms.push(options.guideType);
    if (options.query) terms.push(options.query);
    if (terms.length === 0) terms.push('classes guide');
    else terms.push('guide');

    const fullQuery = terms.join(' ');
    const url = `https://www.wowhead.com/forever/search/suggestions-template?q=${encodeURIComponent(fullQuery)}`;

    const response = await this.http.get(url).json<WowheadSuggestionsResponse>();
    const results = (response.results ?? []).filter(
      (r) => r.type === 100 || r.typeName?.toLowerCase() === 'guide'
    );

    const limit = options.limit ?? 10;
    return results.slice(0, limit).map((r: any) => ({
      id: r.id,
      title: r.name,
      category: r.pinTitle ?? 'Classes',
      updatedDate: r.pinFooterText?.replace(/^Updated:\s*/, ''),
      description: r.pinDescription,
      headerImageUrl: r.pinImageUrl,
      url: `https://www.wowhead.com/forever/guide=${r.id}`,
    }));
  }

  /**
   * Reads and parses item drop, vendor, crafting, and quest sources.
   * Checks for locally saved snapshot file in data/pages/item-{id}.html first.
   * If not found, fetches Wowhead's official unblocked XML payload (/item={id}&xml)
   * which provides structured real drops, vendors, and quest linkages.
   */
  public async getItemSources(itemId: number): Promise<ItemSourcesResult> {
    const cacheKey = `sources:item:${itemId}`;
    const cached = this.getCached<ItemSourcesResult>(cacheKey);
    if (cached) return cached;

    // 1. Check local snapshots directory (e.g. data/pages/item-783.html or 783.html)
    const candidates = [
      path.join(this.pagesDataDir, `item-${itemId}.html`),
      path.join(this.pagesDataDir, `${itemId}.html`),
      path.join(this.pagesDataDir, `item-${itemId}.txt`),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const content = fs.readFileSync(candidate, 'utf8');
          const parsed = parseItemSources(content);
          parsed.itemId = itemId;
          this.setCached(cacheKey, parsed);
          return parsed;
        } catch (err) {
          logger.warn({ err, file: candidate }, 'Failed to parse local snapshot file');
        }
      }
    }

    // 2. Fetch Wowhead's official XML endpoint (/item={id}&xml) which is unblocked by CloudFront
    // and returns structured data for drops, vendors, quest rewards, and crafting recipes.
    const xmlUrl = `https://www.wowhead.com/forever/item=${itemId}&xml`;
    try {
      const xmlRes = await this.http.get(xmlUrl);
      if (xmlRes.statusCode === 200 && xmlRes.body.includes('<wowhead>')) {
        const parsedXml = parseItemXml(xmlRes.body, itemId);
        if (parsedXml.rawListviewsFound.length > 0) {
          this.setCached(cacheKey, parsedXml);
          return parsedXml;
        }
      }
    } catch (err) {
      logger.debug({ err, itemId }, 'XML endpoint lookup failed, falling back to full HTML fetch');
    }

    // 3. Fallback: fetch HTML page directly if cookies are configured
    const url = `https://www.wowhead.com/forever/item=${itemId}`;
    try {
      const response = await this.http.get(url);
      const parsed = parseItemSources(response.body);
      parsed.itemId = itemId;
      this.setCached(cacheKey, parsed);
      return parsed;
    } catch (err: unknown) {
      throw this.wrapFetchError(err, `sources for item #${itemId}`);
    }
  }

  /**
   * Search Wowhead Forever database entities using suggestions-template.
   */
  public async search(
    query: string,
    options: { limit?: number; entityType?: string } = {},
  ): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `search:${trimmed.toLowerCase()}:${options.entityType ?? ''}:${options.limit ?? 10}`;
    const cached = this.getCached<SearchResultItem[]>(cacheKey);
    if (cached) return cached;

    const url = `https://www.wowhead.com/forever/search/suggestions-template?q=${encodeURIComponent(trimmed)}`;
    logger.debug({ url, query: trimmed }, 'Querying Wowhead Forever search');

    let raw: WowheadSuggestionsResponse;
    try {
      const response = await this.http.get(url).json<WowheadSuggestionsResponse>();
      raw = response;
    } catch (err) {
      logger.error({ err, url }, 'Failed to query Wowhead search suggestions');
      throw new Error(`Wowhead search request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    let results = raw.results ?? [];

    if (options.entityType) {
      const targetType = normalizeEntityType(options.entityType);
      results = results.filter((r) => {
        const itemType = normalizeEntityType(r.typeName ?? '');
        return itemType === targetType;
      });
    }

    const limit = options.limit ?? 10;
    const mapped: SearchResultItem[] = results.slice(0, limit).map((r) => ({
      id: r.id,
      type: r.type,
      typeName: r.typeName,
      name: r.name,
      icon: r.icon,
      quality: r.quality,
      qualityName: getQualityName(r.quality),
      description: r.pinDescription,
      footerText: r.pinFooterText,
      breadcrumb: r.pinBreadcrumb,
      url: this.getWebUrl(r.typeName, r.id),
    }));

    // If query starts with common prepositions/stopwords (e.g. "of Orgrimmar", "the Deadmines")
    // and returns no items, query Wowhead with common noun prefixes live
    const hasItems = mapped.some((m) => m.typeName === 'Item');
    const stopwordMatch = trimmed.match(/^(?:of|the|in|for)\s+(.+)$/i);
    if ((mapped.length === 0 || !hasItems || options.entityType === 'item') && stopwordMatch) {
      const noun = stopwordMatch[1];
      const prefixes = ['Staff', 'Axe', 'Kris', 'Hammer', 'Sword', 'Shield', 'Bow', 'Ring', 'Dagger', 'Mace', 'Boots', 'Vest', 'Robes'];
      const expandedItems = new Map<number, SearchResultItem>();

      await Promise.all(
        prefixes.map(async (prefix) => {
          const expUrl = `https://www.wowhead.com/forever/search/suggestions-template?q=${encodeURIComponent(prefix + ' ' + noun)}`;
          try {
            const expRes = await this.http.get(expUrl).json<WowheadSuggestionsResponse>();
            for (const r of expRes.results ?? []) {
              if (r.name.toLowerCase().includes(trimmed.toLowerCase())) {
                expandedItems.set(r.id, {
                  id: r.id,
                  type: r.type,
                  typeName: r.typeName,
                  name: r.name,
                  icon: r.icon,
                  quality: r.quality,
                  qualityName: getQualityName(r.quality),
                  description: r.pinDescription,
                  footerText: r.pinFooterText,
                  breadcrumb: r.pinBreadcrumb,
                  url: this.getWebUrl(r.typeName, r.id),
                });
              }
            }
          } catch {
            // Ignore failure on expansion branch
          }
        })
      );

      if (expandedItems.size > 0) {
        const combined = [...expandedItems.values(), ...mapped];
        this.setCached(cacheKey, combined.slice(0, limit));
        return combined.slice(0, limit);
      }
    }

    this.setCached(cacheKey, mapped);
    return mapped;
  }

  /**
   * Fetch tooltip data from nether.wowhead.com for a specific entity type and ID.
   */
  public async getTooltip(
    entityType: string,
    id: number,
    locale: string | number = 0,
  ): Promise<WowheadEntityDetails> {
    const normType = normalizeEntityType(entityType);
    const cacheKey = `tooltip:${normType}:${id}:${locale}`;
    const cached = this.getCached<WowheadEntityDetails>(cacheKey);
    if (cached) return cached;

    const url = `https://nether.wowhead.com/tooltip/${normType}/${id}?dataEnv=${WOWHEAD_FOREVER_DATA_ENV}&locale=${locale}`;
    logger.debug({ url, entityType: normType, id }, 'Fetching Wowhead Forever tooltip');

    let raw: WowheadTooltipResponse;
    try {
      const response = await this.http.get(url).json<WowheadTooltipResponse>();
      raw = response;
    } catch (err: unknown) {
      const status = (err as { response?: { statusCode?: number } })?.response?.statusCode;
      if (status === 404) {
        throw new Error(`Entity not found in Wowhead Forever database: ${normType} #${id}`);
      }
      logger.error({ err, url }, 'Failed to fetch Wowhead tooltip');
      throw new Error(`Failed to fetch Wowhead tooltip for ${normType} #${id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    const formattedTooltip = formatTooltip(raw.tooltip);
    const buffTooltip = raw.buff ? formatTooltip(raw.buff) : undefined;

    const details: WowheadEntityDetails = {
      id,
      type: normType,
      name: raw.name ?? `${normType} #${id}`,
      quality: raw.quality,
      qualityName: getQualityName(raw.quality),
      icon: raw.icon,
      formattedTooltip,
      rawTooltipHtml: raw.tooltip,
      buffTooltip,
      url: this.getWebUrl(normType, id),
      spells: raw.spells,
      map: raw.map,
    };

    // If this is a quest, attach rewards, infobox details and chain from the full quest page
    if (normType === 'quest') {
      const questData = await this.getQuestDetails(id);
      if (!questData) {
        details.rewardsStatus = 'unavailable';
      } else {
        const hasRewards = Boolean(questData.items || questData.experience || questData.moneyCopper || questData.reputations);
        details.rewardsStatus = hasRewards ? 'ok' : 'none';
        if (hasRewards) {
          details.rewards = {
            items: questData.items,
            experience: questData.experience,
            moneyCopper: questData.moneyCopper,
            reputations: questData.reputations,
          };
        }
        details.questInfo = questData.info;
        details.chain = questData.chain;
      }
      // Don't cache a degraded result for the full TTL; the page may be reachable on retry
      if (details.rewardsStatus === 'unavailable') return details;
    }

    this.setCached(cacheKey, details);
    return details;
  }

  /**
   * Fetches structured item data (type, slot, DPS, stats, class/race restrictions)
   * from Wowhead's item XML endpoint.
   */
  public async getItemInfo(itemId: number): Promise<ItemInfo> {
    const cacheKey = `iteminfo:${itemId}`;
    const cached = this.getCached<ItemInfo>(cacheKey);
    if (cached) return cached;

    const url = `https://www.wowhead.com/forever/item=${itemId}&xml`;
    let body: string;
    try {
      body = (await this.http.get(url)).body;
    } catch (err) {
      throw this.wrapFetchError(err, `item #${itemId} data`);
    }
    const info = parseItemXmlInfo(body);
    if (!info) {
      throw new Error(`Item #${itemId} not found or unparseable in Wowhead Forever item XML`);
    }
    this.setCached(cacheKey, info);
    return info;
  }

  /** Fetches many items' info in parallel; failures are reported per item instead of thrown. */
  public async getItemInfos(itemIds: number[]): Promise<Map<number, ItemInfo | { error: string }>> {
    const unique = [...new Set(itemIds)];
    const results = new Map<number, ItemInfo | { error: string }>();
    const concurrency = 6;
    for (let i = 0; i < unique.length; i += concurrency) {
      await Promise.all(
        unique.slice(i, i + concurrency).map(async (id) => {
          try {
            results.set(id, await this.getItemInfo(id));
          } catch (err) {
            results.set(id, { error: err instanceof Error ? err.message : String(err) });
          }
        }),
      );
    }
    return results;
  }

  /**
   * Fetches a zone page and returns its quest list (levels, sides, rewards) plus the
   * zone's quest reward items with type/DPS/armor data. Requires the session cookie.
   */
  public async getZoneQuests(zoneId: number): Promise<ZoneQuestsPage> {
    const cacheKey = `zonequests:${zoneId}`;
    const cached = this.getCached<ZoneQuestsPage>(cacheKey);
    if (cached) return cached;

    const url = `https://www.wowhead.com/forever/zone=${zoneId}`;
    let body: string;
    try {
      body = (await this.http.get(url)).body;
    } catch (err) {
      throw this.wrapFetchError(err, `zone #${zoneId} page`);
    }
    const parsed = parseZoneQuests(body, zoneId);
    if (!parsed.isZonePage) {
      throw new Error(
        `Zone #${zoneId} page did not contain zone data (possibly a WAF challenge or unknown zone). ` +
          'Check the session with wowhead_get_session_status.',
      );
    }
    this.setCached(cacheKey, parsed);
    return parsed;
  }

  private wrapFetchError(err: unknown, what: string): Error {
    const status = (err as { response?: { statusCode?: number } })?.response?.statusCode;
    if (status === 403 || status === 405 || status === 202) {
      const reason = this.currentCookie ? 'expired or invalid' : 'missing';
      return new Error(
        `[WAF_VERIFICATION_REQUIRED] Wowhead blocked the request for ${what} (HTTP ${status}). ` +
          `The aws-waf-token session cookie is ${reason}. Supply a fresh token via wowhead_set_session_token.`,
      );
    }
    if (status === 404) {
      return new Error(`Not found in Wowhead Forever: ${what}`);
    }
    return new Error(`Failed to fetch ${what}: ${err instanceof Error ? err.message : String(err)}`);
  }

  /**
   * Fetches full quest page details (rewards, XP, money, reputation) from local snapshots
   * or the live Wowhead quest page.
   */
  public async getQuestDetails(questId: number): Promise<QuestPageDetails | undefined> {
    const cacheKey = `quest:details:${questId}`;
    const cached = this.getCached<QuestPageDetails>(cacheKey);
    if (cached) return cached;

    // 1. Check local snapshots
    const candidates = [
      path.join(this.pagesDataDir, `quest-${questId}.html`),
      path.join(this.pagesDataDir, `${questId}.html`),
      path.join(this.pagesDataDir, `quest-${questId}.txt`),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const content = fs.readFileSync(candidate, 'utf8');
          const parsed = parseQuestPage(content, questId);
          this.setCached(cacheKey, parsed);
          return parsed;
        } catch (err) {
          logger.warn({ err, file: candidate }, 'Failed to parse local quest snapshot');
        }
      }
    }

    // 2. Fetch live quest page if session cookie is present
    const url = `https://www.wowhead.com/forever/quest=${questId}`;
    try {
      const response = await this.http.get(url);
      const parsed = parseQuestPage(response.body, questId);
      if (!parsed.isQuestPage) {
        logger.warn({ questId, statusCode: response.statusCode }, 'Quest page response was not a quest page (possible WAF challenge)');
        return undefined;
      }
      this.setCached(cacheKey, parsed);
      return parsed;
    } catch (err: unknown) {
      logger.warn({ err: this.wrapFetchError(err, `quest #${questId} page`).message, questId }, 'Could not fetch live quest page for rewards');
      return undefined;
    }
  }

  /**
   * High-level lookup: searches for query, automatically loads details for top match.
   */
  public async lookup(
    query: string,
    entityType?: string,
  ): Promise<{
    match?: WowheadEntityDetails;
    alternatives: SearchResultItem[];
  }> {
    const searchResults = await this.search(query, {
      limit: 6,
      entityType,
    });

    if (searchResults.length === 0) {
      return { alternatives: [] };
    }

    const top = searchResults[0];
    let matchDetails: WowheadEntityDetails | undefined;

    try {
      matchDetails = await this.getTooltip(top.typeName, top.id);
    } catch (err) {
      logger.warn({ err, top }, 'Could not fetch full tooltip for top search match');
    }

    return {
      match: matchDetails,
      alternatives: searchResults.slice(1),
    };
  }
}
