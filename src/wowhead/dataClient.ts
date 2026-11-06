import got, { type Got } from 'got';
import { DEFAULT_CHROME_UA } from './client.js';

export interface WowheadScalingData {
  spellScaling?: Record<string, any>;
  itemScaling?: Record<string, any>;
}

export class WowheadDataClient {
  private readonly http: Got;
  private itemScalingCache?: Record<string, any>;
  private spellScalingCache?: Record<string, any>;

  constructor(userAgent: string = DEFAULT_CHROME_UA) {
    this.http = got.extend({
      headers: {
        'user-agent': userAgent,
        accept: '*/*',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
      timeout: { request: 10000 },
      retry: { limit: 2 },
    });
  }

  /**
   * Fetches Wowhead's global spec and class spell association matrix.
   */
  public async getSpecSpells(): Promise<{
    class: Record<string, number[]>;
    spec: Record<string, number[]>;
    specMap: Record<string, number>;
  }> {
    const url = 'https://nether.wowhead.com/data/spec-spells?dataEnv=16';
    return this.http.get(url).json();
  }

  /**
   * Fetches Wowhead's full talents database across all specs for WoW: Forever.
   */
  public async getTalentTrees(): Promise<Record<string, Record<string, any>>> {
    const url = 'https://nether.wowhead.com/forever/data/talents-classic?dv=34&db=1793836334';
    const res = await this.http.get(url);
    const prefix = 'WH.setPageData("wow.talentCalcClassic.classicplus.data",';
    const startIdx = res.body.indexOf(prefix);
    if (startIdx === -1) {
      throw new Error('Talent dataset header not found in Wowhead response');
    }
    const jsonStart = startIdx + prefix.length;
    const jsonEnd = res.body.indexOf(');', jsonStart);
    const parsed = JSON.parse(res.body.slice(jsonStart, jsonEnd));
    return parsed.talents ?? {};
  }

  /**
   * Fetches Wowhead's global item stat-scaling matrix (ilvl, budget allocations, curves).
   */
  public async getItemScaling(): Promise<Record<string, any>> {
    if (this.itemScalingCache) return this.itemScalingCache;
    const url = 'https://nether.wowhead.com/data/item-scaling';
    const data = await this.http.get(url).json<Record<string, any>>();
    this.itemScalingCache = data;
    return data;
  }

  /**
   * Fetches Wowhead's global spell coefficient scaling data table.
   */
  public async getSpellScaling(): Promise<Record<string, any>> {
    if (this.spellScalingCache) return this.spellScalingCache;
    const url = 'https://nether.wowhead.com/data/spell-scaling';
    const data = await this.http.get(url).json<Record<string, any>>();
    this.spellScalingCache = data;
    return data;
  }

  /**
   * Generates URLs for 3D character and item model viewers on Wowhead.
   */
  public getModelViewerUrl(displayId: number, type: 'item' | 'npc' = 'item'): string {
    return `https://www.wowhead.com/forever/modelviewer?type=${type}&displayId=${displayId}`;
  }

  /**
   * Generates direct high-resolution icon URLs from Wowhead's CDN.
   */
  public getIconUrl(iconName: string, size: 'small' | 'medium' | 'large' = 'large'): string {
    const clean = iconName.toLowerCase().replace(/\.jpg|\.png/g, '');
    return `https://wow.zamimg.com/images/wow/icons/${size}/${clean}.jpg`;
  }
}
