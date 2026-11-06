/**
 * Metadata and definitions for World of Warcraft character classes.
 */

export interface WowheadClassSpec {
  id: number;
  name: string;
  role: 'DPS' | 'Healer' | 'Tank';
  icon: string;
  description: string;
}

export interface WowheadClassDefinition {
  id: number;
  slug: string;
  name: string;
  icon: string;
  armorTypes: string[];
  weaponTypes: string[];
  roles: ('DPS' | 'Healer' | 'Tank')[];
  resource: string;
  availableRaces: {
    alliance: string[];
    horde: string[];
  };
  specs: WowheadClassSpec[];
  webUrl: string;
}

export const WOW_CLASSES: Record<number, WowheadClassDefinition> = {
  1: {
    id: 1,
    slug: 'warrior',
    name: 'Warrior',
    icon: 'classicon_warrior',
    armorTypes: ['Mail (level 1-39)', 'Plate (level 40+)', 'Shields'],
    weaponTypes: ['Axes', 'Maces', 'Swords', 'Polearms', 'Daggers', 'Staves', 'Bows', 'Crossbows', 'Guns', 'Thrown'],
    roles: ['DPS', 'Tank'],
    resource: 'Rage',
    availableRaces: {
      alliance: ['Human', 'Dwarf', 'Night Elf', 'Gnome'],
      horde: ['Orc', 'Undead', 'Tauren', 'Troll'],
    },
    specs: [
      { id: 161, name: 'Arms', role: 'DPS', icon: 'ability_warrior_savageblow', description: 'Master of two-handed weaponry and calculated melee burst.' },
      { id: 164, name: 'Fury', role: 'DPS', icon: 'ability_warrior_innerrage', description: 'Berserker wielding dual weapons with rapid fury.' },
      { id: 163, name: 'Protection', role: 'Tank', icon: 'inv_shield_06', description: 'Stalwart defender utilizing sword and shield to protect allies.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=1/warrior',
  },
  2: {
    id: 2,
    slug: 'paladin',
    name: 'Paladin',
    icon: 'classicon_paladin',
    armorTypes: ['Mail (level 1-39)', 'Plate (level 40+)', 'Shields'],
    weaponTypes: ['One-Handed Maces', 'Two-Handed Maces', 'One-Handed Swords', 'Two-Handed Swords', 'Polearms'],
    roles: ['DPS', 'Healer', 'Tank'],
    resource: 'Mana',
    availableRaces: {
      alliance: ['Human', 'Dwarf'],
      horde: [],
    },
    specs: [
      { id: 382, name: 'Holy', role: 'Healer', icon: 'spell_holy_holybolt', description: 'Devout healer invoking the power of the Light.' },
      { id: 383, name: 'Protection', role: 'Tank', icon: 'spell_holy_devotionaura', description: 'Shield of righteousness shielding companions with holy energy.' },
      { id: 381, name: 'Retribution', role: 'DPS', icon: 'spell_holy_auraoflight', description: 'Zealous crusader delivering holy justice in melee.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=2/paladin',
  },
  3: {
    id: 3,
    slug: 'hunter',
    name: 'Hunter',
    icon: 'classicon_hunter',
    armorTypes: ['Leather (level 1-39)', 'Mail (level 40+)'],
    weaponTypes: ['Bows', 'Crossbows', 'Guns', 'Polearms', 'Staves', 'One-Handed Axes', 'Two-Handed Axes', 'One-Handed Swords', 'Two-Handed Swords', 'Daggers'],
    roles: ['DPS'],
    resource: 'Mana',
    availableRaces: {
      alliance: ['Dwarf', 'Night Elf'],
      horde: ['Orc', 'Tauren', 'Troll'],
    },
    specs: [
      { id: 361, name: 'Beast Mastery', role: 'DPS', icon: 'ability_hunter_beasttaming', description: 'Bonds with beasts and empowers wild companion creatures.' },
      { id: 363, name: 'Marksmanship', role: 'DPS', icon: 'ability_marksmanship', description: 'Deadly sharpshooter delivering precision physical damage from afar.' },
      { id: 362, name: 'Survival', role: 'DPS', icon: 'ability_hunter_swiftstrike', description: 'Resourceful tracker utilizing traps, venom, and tactical melee.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=3/hunter',
  },
  4: {
    id: 4,
    slug: 'rogue',
    name: 'Rogue',
    icon: 'classicon_rogue',
    armorTypes: ['Cloth', 'Leather'],
    weaponTypes: ['Daggers', 'One-Handed Swords', 'One-Handed Maces', 'Fist Weapons', 'Bows', 'Crossbows', 'Guns', 'Thrown'],
    roles: ['DPS'],
    resource: 'Energy',
    availableRaces: {
      alliance: ['Human', 'Dwarf', 'Night Elf', 'Gnome'],
      horde: ['Orc', 'Undead', 'Troll'],
    },
    specs: [
      { id: 182, name: 'Assassination', role: 'DPS', icon: 'ability_rogue_eviscerate', description: 'Deadly master of poisons and swift dagger strikes.' },
      { id: 181, name: 'Combat', role: 'DPS', icon: 'ability_backstab', description: 'Brawler thriving in direct confrontation and sustained sword combat.' },
      { id: 183, name: 'Subtlety', role: 'DPS', icon: 'ability_stealth', description: 'Shadowstalker striking unawares from stealth.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=4/rogue',
  },
  5: {
    id: 5,
    slug: 'priest',
    name: 'Priest',
    icon: 'classicon_priest',
    armorTypes: ['Cloth'],
    weaponTypes: ['One-Handed Maces', 'Daggers', 'Staves', 'Wands'],
    roles: ['DPS', 'Healer'],
    resource: 'Mana',
    availableRaces: {
      alliance: ['Human', 'Dwarf', 'Night Elf'],
      horde: ['Undead', 'Troll'],
    },
    specs: [
      { id: 201, name: 'Discipline', role: 'Healer', icon: 'spell_holy_wordfortitude', description: 'Balances shielding wards and mitigation.' },
      { id: 202, name: 'Holy', role: 'Healer', icon: 'spell_holy_guardianspirit', description: 'Versatile healer channeling celestial light.' },
      { id: 203, name: 'Shadow', role: 'DPS', icon: 'spell_shadow_shadowwordpain', description: 'Uses sinister shadow magic to torment enemies minds.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=5/priest',
  },
  7: {
    id: 7,
    slug: 'shaman',
    name: 'Shaman',
    icon: 'classicon_shaman',
    armorTypes: ['Leather (level 1-39)', 'Mail (level 40+)', 'Shields'],
    weaponTypes: ['One-Handed Maces', 'Two-Handed Maces', 'One-Handed Axes', 'Two-Handed Axes', 'Staves', 'Daggers', 'Fist Weapons'],
    roles: ['DPS', 'Healer'],
    resource: 'Mana',
    availableRaces: {
      alliance: [],
      horde: ['Orc', 'Tauren', 'Troll'],
    },
    specs: [
      { id: 261, name: 'Elemental', role: 'DPS', icon: 'spell_nature_lightning', description: 'Commands the destructive forces of lightning, fire, and earth.' },
      { id: 263, name: 'Enhancement', role: 'DPS', icon: 'spell_shaman_improvedstormstrike', description: 'Imbues weapons with primal elements to strike in melee.' },
      { id: 262, name: 'Restoration', role: 'Healer', icon: 'spell_nature_magicimmunity', description: 'Calls upon ancestral spirits and cleansing water to heal allies.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=7/shaman',
  },
  8: {
    id: 8,
    slug: 'mage',
    name: 'Mage',
    icon: 'classicon_mage',
    armorTypes: ['Cloth'],
    weaponTypes: ['One-Handed Swords', 'Daggers', 'Staves', 'Wands'],
    roles: ['DPS'],
    resource: 'Mana',
    availableRaces: {
      alliance: ['Human', 'Gnome'],
      horde: ['Undead', 'Troll'],
    },
    specs: [
      { id: 81, name: 'Arcane', role: 'DPS', icon: 'spell_holy_magicalsentry', description: 'Manipulates raw arcane energy and temporal currents.' },
      { id: 41, name: 'Fire', role: 'DPS', icon: 'spell_fire_firebolt02', description: 'Incinerates foes with explosive bursts of flame.' },
      { id: 61, name: 'Frost', role: 'DPS', icon: 'spell_frost_frostbolt02', description: 'Controls the battlefield with freezing chill and ice.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=8/mage',
  },
  9: {
    id: 9,
    slug: 'warlock',
    name: 'Warlock',
    icon: 'classicon_warlock',
    armorTypes: ['Cloth'],
    weaponTypes: ['One-Handed Swords', 'Daggers', 'Staves', 'Wands'],
    roles: ['DPS'],
    resource: 'Mana',
    availableRaces: {
      alliance: ['Human', 'Gnome'],
      horde: ['Orc', 'Undead'],
    },
    specs: [
      { id: 302, name: 'Affliction', role: 'DPS', icon: 'spell_shadow_deathcoil', description: 'Master of persistent shadow curses and drains.' },
      { id: 303, name: 'Demonology', role: 'DPS', icon: 'spell_shadow_metamorphosis', description: 'Summons and commands powerful demonic minions.' },
      { id: 301, name: 'Destruction', role: 'DPS', icon: 'spell_shadow_rainoffire', description: 'Rains chaotic shadow and fire upon adversaries.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=9/warlock',
  },
  11: {
    id: 11,
    slug: 'druid',
    name: 'Druid',
    icon: 'classicon_druid',
    armorTypes: ['Cloth', 'Leather'],
    weaponTypes: ['One-Handed Maces', 'Two-Handed Maces', 'Polearms', 'Staves', 'Daggers', 'Fist Weapons'],
    roles: ['DPS', 'Healer', 'Tank'],
    resource: 'Mana / Rage (Bear) / Energy (Cat)',
    availableRaces: {
      alliance: ['Night Elf'],
      horde: ['Tauren'],
    },
    specs: [
      { id: 283, name: 'Balance', role: 'DPS', icon: 'spell_nature_starfall', description: 'Harnesses lunar and solar power in Moonkin form.' },
      { id: 281, name: 'Feral Combat', role: 'DPS', icon: 'ability_racial_bearform', description: 'Shapeshifts into cat for stealth melee or bear for tanking.' },
      { id: 282, name: 'Restoration', role: 'Healer', icon: 'spell_nature_healingtouch', description: 'Maintains health with potent heal-over-time natural flora.' },
    ],
    webUrl: 'https://www.wowhead.com/forever/class=11/druid',
  },
};

export function findClass(identifier: string | number): WowheadClassDefinition | undefined {
  if (typeof identifier === 'number') {
    return WOW_CLASSES[identifier];
  }
  const clean = identifier.toLowerCase().trim();
  const numeric = parseInt(clean, 10);
  if (!isNaN(numeric) && WOW_CLASSES[numeric]) {
    return WOW_CLASSES[numeric];
  }
  return Object.values(WOW_CLASSES).find(
    (c) => c.slug === clean || c.name.toLowerCase() === clean
  );
}
