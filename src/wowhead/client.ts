import got, { type Got } from 'got';
import {
  type WowheadSuggestionsResponse,
  type WowheadTooltipResponse,
  type SearchResultItem,
  type WowheadEntityDetails,
} from './types.js';
import { formatTooltip, getQualityName } from './formatter.js';
import { logger } from '../util/logger.js';

export const WOWHEAD_FOREVER_DATA_ENV = 16;
export const DEFAULT_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface WowheadClientOptions {
  userAgent?: string;
  cacheTtlMs?: number;
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
  private readonly http: Got;
  private readonly userAgent: string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(options: WowheadClientOptions = {}) {
    this.userAgent =
      options.userAgent ??
      process.env['WOWHEAD_USER_AGENT'] ??
      DEFAULT_CHROME_UA;
    this.cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000; // 10 minutes default

    this.http = got.extend({
      headers: {
        'user-agent': this.userAgent,
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      timeout: {
        request: 10000,
      },
      retry: {
        limit: 2,
      },
    });
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
    return `https://www.wowhead.com/forever/${norm}=${id}`;
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

    this.setCached(cacheKey, details);
    return details;
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
