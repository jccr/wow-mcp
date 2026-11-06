/**
 * Structured item data (type, stats, restrictions) parsed from Wowhead's item XML
 * endpoint (`/item={id}&xml`), plus class/race usability checks and item comparison.
 */

/** Wowhead race bitmask (classic races). */
export const RACE_MASK: Record<number, string> = {
  1: 'Human',
  2: 'Orc',
  4: 'Dwarf',
  8: 'Night Elf',
  16: 'Undead',
  32: 'Tauren',
  64: 'Gnome',
  128: 'Troll',
};

/** Wowhead class bitmask (classic classes). */
export const CLASS_MASK: Record<number, string> = {
  1: 'Warrior',
  2: 'Paladin',
  4: 'Hunter',
  8: 'Rogue',
  16: 'Priest',
  64: 'Shaman',
  128: 'Mage',
  256: 'Warlock',
  1024: 'Druid',
};

export const ITEM_CLASS_NAMES: Record<number, string> = {
  0: 'Consumable',
  1: 'Container',
  2: 'Weapon',
  4: 'Armor',
  5: 'Reagent',
  7: 'Trade Goods',
  9: 'Recipe',
  12: 'Quest',
  15: 'Miscellaneous',
};

export const WEAPON_SUBCLASS_NAMES: Record<number, string> = {
  0: 'One-Handed Axe',
  1: 'Two-Handed Axe',
  2: 'Bow',
  3: 'Gun',
  4: 'One-Handed Mace',
  5: 'Two-Handed Mace',
  6: 'Polearm',
  7: 'One-Handed Sword',
  8: 'Two-Handed Sword',
  10: 'Staff',
  13: 'Fist Weapon',
  14: 'Miscellaneous',
  15: 'Dagger',
  16: 'Thrown',
  18: 'Crossbow',
  19: 'Wand',
  20: 'Fishing Pole',
};

export const ARMOR_SUBCLASS_NAMES: Record<number, string> = {
  0: 'Miscellaneous',
  1: 'Cloth',
  2: 'Leather',
  3: 'Mail',
  4: 'Plate',
  6: 'Shield',
  7: 'Libram',
  8: 'Idol',
  9: 'Totem',
};

/** Inventory slot ids used by Wowhead's `slot` field. */
export const SLOT_NAMES: Record<number, string> = {
  0: 'Non-equippable',
  1: 'Head',
  2: 'Neck',
  3: 'Shoulder',
  4: 'Shirt',
  5: 'Chest',
  6: 'Waist',
  7: 'Legs',
  8: 'Feet',
  9: 'Wrist',
  10: 'Hands',
  11: 'Finger',
  12: 'Trinket',
  13: 'One-Hand',
  14: 'Off Hand (Shield)',
  15: 'Ranged',
  16: 'Back',
  17: 'Two-Hand',
  18: 'Bag',
  19: 'Tabard',
  20: 'Chest (Robe)',
  21: 'Main Hand',
  22: 'Off Hand',
  23: 'Held In Off-hand',
  25: 'Thrown',
  26: 'Ranged (Gun/Crossbow/Wand)',
  28: 'Relic',
};

/** jsonEquip keys mapped to readable stat names. */
const STAT_KEYS: Record<string, string> = {
  str: 'strength',
  agi: 'agility',
  sta: 'stamina',
  int: 'intellect',
  spi: 'spirit',
  spldmg: 'spellDamage',
  splheal: 'spellHealing',
  armorbonus: 'bonusArmor',
  mleatkpwr: 'attackPower',
  atkpwr: 'attackPower',
  rgdatkpwr: 'rangedAttackPower',
  mlecritstrkpct: 'critPercent',
  mlehitpct: 'hitPercent',
  manargn: 'mp5',
  healthrgn: 'hp5',
  firres: 'fireResistance',
  frores: 'frostResistance',
  natres: 'natureResistance',
  shares: 'shadowResistance',
  arcres: 'arcaneResistance',
};

export interface ItemInfo {
  id: number;
  name: string;
  quality?: number;
  itemLevel?: number;
  requiredLevel?: number;
  itemClassId?: number;
  itemClass?: string;
  subclassId?: number;
  subclass?: string;
  slotId?: number;
  slot?: string;
  dps?: number;
  speed?: number;
  damageMin?: number;
  damageMax?: number;
  armor?: number;
  stats: Record<string, number>;
  /** Races allowed to use the item; undefined means no race restriction. */
  races?: string[];
  /** Classes allowed to use the item; undefined means no class restriction. */
  classes?: string[];
  sellPriceCopper?: number;
}

/** Decodes a Wowhead bitmask into names. Returns undefined for 0/absent (no restriction). */
export function decodeMask(mask: number | undefined, table: Record<number, string>): string[] | undefined {
  if (!mask || mask <= 0) return undefined;
  const names = Object.entries(table)
    .filter(([bit]) => (mask & Number(bit)) !== 0)
    .map(([, name]) => name);
  // A mask covering every known value is effectively unrestricted
  if (names.length === Object.keys(table).length) return undefined;
  return names.length > 0 ? names : undefined;
}

export function subclassName(itemClassId?: number, subclassId?: number): string | undefined {
  if (subclassId === undefined) return undefined;
  if (itemClassId === 2) return WEAPON_SUBCLASS_NAMES[subclassId];
  if (itemClassId === 4) return subclassId === -6 ? 'Cloak' : ARMOR_SUBCLASS_NAMES[subclassId];
  return undefined;
}

function parseCdataObject(xml: string, tag: string): Record<string, any> | undefined {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw.startsWith('{') ? raw : `{${raw}}`);
  } catch {
    return undefined;
  }
}

/**
 * Builds an ItemInfo from raw Wowhead row fields (item XML `json` + `jsonEquip`, or a
 * `quest-rewards` listview row, which carries the same keys minus most stats).
 */
export function buildItemInfo(json: Record<string, any>, equip: Record<string, any> = {}): ItemInfo {
  const itemClassId = typeof json.classs === 'number' ? json.classs : undefined;
  const subclassId = typeof json.subclass === 'number' ? json.subclass : undefined;
  const slotId = typeof json.slot === 'number' ? json.slot : typeof json.slotbak === 'number' ? json.slotbak : undefined;

  const stats: Record<string, number> = {};
  for (const [key, label] of Object.entries(STAT_KEYS)) {
    const value = equip[key] ?? json[key];
    if (typeof value === 'number' && value !== 0) {
      stats[label] = (stats[label] ?? 0) + value;
    }
  }

  const dps = equip.mledps ?? equip.dps ?? json.dps;
  const speed = equip.mlespeed ?? equip.speed ?? json.speed;
  const armor = equip.armor ?? json.armor;

  return {
    id: json.id,
    name: json.displayName ?? json.name ?? `Item #${json.id}`,
    quality: json.quality,
    itemLevel: json.level,
    requiredLevel: json.reqlevel,
    itemClassId,
    itemClass: itemClassId !== undefined ? ITEM_CLASS_NAMES[itemClassId] : undefined,
    subclassId,
    subclass: subclassName(itemClassId, subclassId),
    slotId,
    slot: slotId !== undefined ? SLOT_NAMES[slotId] : undefined,
    dps: typeof dps === 'number' && dps > 0 ? dps : undefined,
    speed: typeof speed === 'number' && speed > 0 ? speed : undefined,
    damageMin: equip.dmgmin1 ?? equip.mledmgmin,
    damageMax: equip.dmgmax1 ?? equip.mledmgmax,
    armor: typeof armor === 'number' && armor > 0 ? armor : undefined,
    stats,
    races: decodeMask(json.reqrace ?? equip.races, RACE_MASK),
    classes: decodeMask(json.reqclass ?? equip.classes, CLASS_MASK),
    sellPriceCopper: equip.sellprice,
  };
}

/** Parses Wowhead's item XML payload (`/item={id}&xml`) into an ItemInfo. */
export function parseItemXmlInfo(xml: string): ItemInfo | undefined {
  const json = parseCdataObject(xml, 'json');
  if (!json || typeof json.id !== 'number') return undefined;
  const equip = parseCdataObject(xml, 'jsonEquip') ?? {};
  return buildItemInfo(json, equip);
}

/**
 * Weapon and armor subclasses each class can train without talents (classic rules).
 * `talentGated` lists subclasses only reachable through a talent.
 */
export const CLASS_PROFICIENCIES: Record<string, { weapons: number[]; armor: number[]; talentGated?: number[] }> = {
  warrior: { weapons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 13, 15, 16, 18], armor: [1, 2, 3, 4, 6] },
  paladin: { weapons: [0, 1, 4, 5, 6, 7, 8], armor: [1, 2, 3, 4, 6, 7] },
  hunter: { weapons: [0, 1, 2, 3, 6, 7, 8, 10, 13, 15, 16, 18], armor: [1, 2, 3] },
  rogue: { weapons: [2, 3, 4, 7, 13, 15, 16, 18], armor: [1, 2] },
  priest: { weapons: [4, 10, 15, 19], armor: [1] },
  shaman: { weapons: [0, 4, 10, 13, 15], armor: [1, 2, 3, 6, 9], talentGated: [1, 5] },
  mage: { weapons: [7, 10, 15, 19], armor: [1] },
  warlock: { weapons: [7, 10, 15, 19], armor: [1] },
  druid: { weapons: [4, 5, 10, 13, 15], armor: [1, 2, 8] },
};

/** Minimum level for armor subclasses that unlock later (classic rules). */
const ARMOR_UNLOCK_LEVEL: Record<string, Record<number, number>> = {
  warrior: { 4: 40 },
  paladin: { 4: 40 },
  hunter: { 3: 40 },
  shaman: { 3: 40 },
};

export interface UsabilityResult {
  usable: boolean;
  reasons: string[];
}

/**
 * Checks whether a character can equip an item. Unknown inputs are treated as
 * permissive; every blocking condition is listed in `reasons`.
 */
export function checkUsability(
  item: Pick<ItemInfo, 'itemClassId' | 'subclassId' | 'subclass' | 'races' | 'classes' | 'requiredLevel'>,
  character: { className?: string; race?: string; level?: number; includeTalentGated?: boolean },
): UsabilityResult {
  const reasons: string[] = [];
  const classKey = character.className?.toLowerCase().trim();

  if (classKey && item.classes && !item.classes.some((c) => c.toLowerCase() === classKey)) {
    reasons.push(`Class restricted to ${item.classes.join(', ')}`);
  }
  if (character.race && item.races) {
    const raceKey = character.race.toLowerCase().trim();
    if (!item.races.some((r) => r.toLowerCase() === raceKey)) {
      reasons.push(`Race restricted to ${item.races.join(', ')}`);
    }
  }
  if (character.level !== undefined && item.requiredLevel !== undefined && item.requiredLevel > character.level) {
    reasons.push(`Requires level ${item.requiredLevel}`);
  }

  const prof = classKey ? CLASS_PROFICIENCIES[classKey] : undefined;
  if (prof && item.subclassId !== undefined) {
    if (item.itemClassId === 2) {
      const gated = prof.talentGated?.includes(item.subclassId) ?? false;
      if (!prof.weapons.includes(item.subclassId) && !(gated && character.includeTalentGated)) {
        reasons.push(
          gated
            ? `${item.subclass ?? 'This weapon type'} requires a talent for ${character.className}`
            : `${character.className} cannot use ${item.subclass ?? 'this weapon type'}`,
        );
      }
    } else if (item.itemClassId === 4 && item.subclassId > 0) {
      // 0 = miscellaneous (rings, necks, trinkets); negative ids (-6 = cloak) are wearable by everyone
      if (!prof.armor.includes(item.subclassId)) {
        reasons.push(`${character.className} cannot wear ${item.subclass ?? 'this armor type'}`);
      } else {
        const unlock = ARMOR_UNLOCK_LEVEL[classKey!]?.[item.subclassId];
        if (unlock && character.level !== undefined && character.level < unlock) {
          reasons.push(`${item.subclass} unlocks at level ${unlock} for ${character.className}`);
        }
      }
    }
  }

  return { usable: reasons.length === 0, reasons };
}

/**
 * Groups inventory slots that compete for the same equipment slot: any main-hand capable
 * weapon replaces another, robes replace chests, shields/off-hands/held items share the off hand.
 */
const SLOT_GROUPS: Record<number, string> = {
  13: 'main-hand',
  17: 'main-hand',
  21: 'main-hand',
  14: 'off-hand',
  22: 'off-hand',
  23: 'off-hand',
  5: 'chest',
  20: 'chest',
  15: 'ranged',
  25: 'ranged',
  26: 'ranged',
  28: 'ranged',
};

export function slotGroup(slotId: number | undefined): string | undefined {
  if (slotId === undefined || slotId === 0) return undefined;
  return SLOT_GROUPS[slotId] ?? `slot-${slotId}`;
}

/** Picks the equipped item occupying the same slot as the candidate (lowest item level for rings/trinkets). */
export function findEquippedInSlot(candidate: Pick<ItemInfo, 'slotId'>, equipped: ItemInfo[]): ItemInfo | undefined {
  const group = slotGroup(candidate.slotId);
  if (!group) return undefined;
  const matches = equipped.filter((e) => slotGroup(e.slotId) === group);
  if (matches.length <= 1) return matches[0];
  return [...matches].sort((a, b) => (a.itemLevel ?? 0) - (b.itemLevel ?? 0))[0];
}

/** Number of items a slot group holds (two rings, two trinkets). */
export function slotCapacity(slotId: number | undefined): number {
  return slotId === 11 || slotId === 12 ? 2 : 1;
}

export interface ItemComparison {
  comparedToItemId: number;
  comparedToName: string;
  dpsDelta?: number;
  speedDelta?: number;
  armorDelta?: number;
  itemLevelDelta?: number;
  statDeltas: Record<string, number>;
  notes: string[];
}

/** Compares a candidate item against a currently equipped one (positive = candidate is higher). */
export function compareItems(candidate: ItemInfo, current: ItemInfo): ItemComparison {
  const round = (n: number) => Number(n.toFixed(2));
  const delta = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : round((a ?? 0) - (b ?? 0)));

  const statDeltas: Record<string, number> = {};
  for (const key of new Set([...Object.keys(candidate.stats), ...Object.keys(current.stats)])) {
    const d = round((candidate.stats[key] ?? 0) - (current.stats[key] ?? 0));
    if (d !== 0) statDeltas[key] = d;
  }

  const notes: string[] = [];
  if (candidate.slotId !== undefined && current.slotId !== undefined && candidate.slotId !== current.slotId) {
    notes.push(`Different slot: ${candidate.slot ?? candidate.slotId} vs ${current.slot ?? current.slotId}`);
  }

  return {
    comparedToItemId: current.id,
    comparedToName: current.name,
    dpsDelta: candidate.dps !== undefined || current.dps !== undefined ? delta(candidate.dps, current.dps) : undefined,
    speedDelta: candidate.speed !== undefined && current.speed !== undefined ? delta(candidate.speed, current.speed) : undefined,
    armorDelta: candidate.armor !== undefined || current.armor !== undefined ? delta(candidate.armor, current.armor) : undefined,
    itemLevelDelta: delta(candidate.itemLevel, current.itemLevel),
    statDeltas,
    notes,
  };
}
