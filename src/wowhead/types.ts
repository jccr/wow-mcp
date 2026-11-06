import { z } from 'zod';
import type { QuestInfo, QuestPageDetails } from './pageParser.js';

export type WowheadEntityType =
  | 'item'
  | 'spell'
  | 'quest'
  | 'npc'
  | 'object'
  | 'zone'
  | 'item-set'
  | 'guide'
  | 'class'
  | 'race';

export const entityTypeEnum = z.enum([
  'item',
  'spell',
  'quest',
  'npc',
  'object',
  'zone',
  'item-set',
  'guide',
  'class',
  'race',
]);

/** Raw suggestion entry from Wowhead suggestions-template */
export interface WowheadSuggestion {
  type: number;
  id: number;
  name: string;
  typeName: string;
  icon?: string;
  quality?: number;
  pinTitle?: string;
  pinFooterText?: string;
  pinDescription?: string;
  pinBreadcrumb?: string[];
  popularity?: number;
  side?: number;
  classId?: number;
}

/** Raw response from suggestions-template */
export interface WowheadSuggestionsResponse {
  search: string;
  results?: WowheadSuggestion[];
}

/** Formatted search result item */
export interface SearchResultItem {
  id: number;
  type: number;
  typeName: string;
  name: string;
  icon?: string;
  quality?: number;
  qualityName?: string;
  description?: string;
  footerText?: string;
  breadcrumb?: string[];
  url: string;
}

/** Formatted class guide item */
export interface WowheadClassGuideItem {
  id: number;
  title: string;
  category: string;
  updatedDate?: string;
  description?: string;
  headerImageUrl?: string;
  url: string;
  slugPath?: string;
  author?: string;
  patch?: string;
}

/** Raw tooltip response from nether.wowhead.com */
export interface WowheadTooltipResponse {
  name?: string;
  quality?: number;
  icon?: string;
  tooltip?: string;
  tooltip2?: string;
  buff?: string;
  spells?: unknown;
  buffspells?: unknown;
  completion_category?: number;
  map?: Record<string, unknown>;
}

/** Structured parsed entity details */
export interface WowheadEntityDetails {
  id: number;
  type: string;
  name: string;
  quality?: number;
  qualityName?: string;
  icon?: string;
  formattedTooltip: string;
  rawTooltipHtml?: string;
  buffTooltip?: string;
  url: string;
  spells?: unknown;
  map?: Record<string, unknown>;
  /** Quests only: 'ok' = rewards parsed, 'none' = page has no rewards, 'unavailable' = page could not be fetched. */
  rewardsStatus?: 'ok' | 'none' | 'unavailable';
  rewards?: {
    items?: Array<{ id: number; name: string; choice?: boolean; info?: unknown }>;
    experience?: number;
    moneyCopper?: number;
    reputations?: Array<{ factionId: number; factionName: string; amount: number }>;
  };
  /** Quests only: level, required level, side, start/end NPCs from the quest page infobox. */
  questInfo?: QuestInfo;
  /** Quests only: the quest series this quest belongs to. */
  chain?: QuestPageDetails['chain'];
}
