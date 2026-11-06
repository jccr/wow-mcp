/**
 * Curated database of World of Warcraft: Forever dungeons, level ranges,
 * zones, associated dungeon quests, and direct Wowhead guide links.
 */

export interface DungeonQuestEntry {
  id?: number;
  name: string;
  minLevel?: number;
  faction?: 'Alliance' | 'Horde' | 'Both';
  questGiver?: string;
  questLocation?: string;
  isShareable?: boolean;
}

export interface ForeverDungeon {
  id: string;
  name: string;
  zone: string;
  zoneId?: number;
  levelRange: [number, number];
  recommendedLevel: number;
  faction: 'Alliance' | 'Horde' | 'Neutral';
  overviewGuideId: number;
  guideUrl: string;
  quests: DungeonQuestEntry[];
}

export const FOREVER_DUNGEONS: ForeverDungeon[] = [
  {
    id: 'ragefire-chasm',
    name: 'Ragefire Chasm',
    zone: 'Orgrimmar',
    zoneId: 1637,
    levelRange: [13, 18],
    recommendedLevel: 15,
    faction: 'Horde',
    overviewGuideId: 34928,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/ragefire-chasm-overview',
    quests: [
      { id: 3065, name: 'Searching for the Lost Satchel', minLevel: 9, faction: 'Horde', questGiver: 'Rahauro', questLocation: 'Thunder Bluff' },
      { id: 3066, name: 'Testing an Enemy\'s Strength', minLevel: 9, faction: 'Horde', questGiver: 'Rahauro', questLocation: 'Thunder Bluff' },
      { id: 3062, name: 'Slaying the Beast', minLevel: 9, faction: 'Horde', questGiver: 'Neeru Fireblade', questLocation: 'Orgrimmar' },
      { id: 3063, name: 'The Power to Destroy...', minLevel: 9, faction: 'Horde', questGiver: 'Varimathras', questLocation: 'Undercity' },
      { id: 5727, name: 'Hidden Enemies', minLevel: 9, faction: 'Horde', questGiver: 'Thrall', questLocation: 'Orgrimmar' },
    ],
  },
  {
    id: 'wailing-caverns',
    name: 'Wailing Caverns',
    zone: 'The Barrens',
    zoneId: 17,
    levelRange: [17, 24],
    recommendedLevel: 20,
    faction: 'Neutral',
    overviewGuideId: 34961,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/wailing-caverns-overview',
    quests: [
      { id: 897, name: 'Trouble at the Docks', minLevel: 14, faction: 'Both', questGiver: 'Crane Operator Bigglefuzz', questLocation: 'Ratchet' },
      { id: 870, name: 'Smart Drinks', minLevel: 13, faction: 'Both', questGiver: 'Mangletooth', questLocation: 'Ratchet' },
      { id: 914, name: 'Raptor Horns', minLevel: 13, faction: 'Both', questGiver: 'Mangletooth', questLocation: 'Ratchet' },
      { id: 884, name: 'Eradicate the Deviate Swarm', minLevel: 13, faction: 'Both', questGiver: 'Ebru', questLocation: 'Wailing Caverns Eye' },
      { id: 885, name: 'Deviate Hides', minLevel: 13, faction: 'Both', questGiver: 'Nalpak', questLocation: 'Wailing Caverns Eye' },
      { id: 924, name: 'Leaders of the Fang', minLevel: 10, faction: 'Horde', questGiver: 'Nara Wildmane', questLocation: 'Thunder Bluff' },
      { id: 927, name: 'The Glowing Shard', minLevel: 15, faction: 'Both', questGiver: 'Mutanus the Devourer (Drop)', questLocation: 'Inside Dungeon' },
    ],
  },
  {
    id: 'the-deadmines',
    name: 'The Deadmines',
    zone: 'Westfall',
    zoneId: 40,
    levelRange: [18, 23],
    recommendedLevel: 20,
    faction: 'Alliance',
    overviewGuideId: 34947,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/the-deadmines-overview',
    quests: [
      { id: 166, name: 'The Defias Brotherhood', minLevel: 14, faction: 'Alliance', questGiver: 'Gryan Stoutmantle', questLocation: 'Westfall' },
      { id: 109, name: 'Red Silk Bandanas', minLevel: 14, faction: 'Alliance', questGiver: 'Scout Riell', questLocation: 'Westfall' },
      { id: 168, name: 'Collecting Memories', minLevel: 14, faction: 'Alliance', questGiver: 'Wilder Thistlenettle', questLocation: 'Stormwind' },
      { id: 167, name: 'Oh Brother. . .', minLevel: 15, faction: 'Alliance', questGiver: 'Wilder Thistlenettle', questLocation: 'Stormwind' },
      { id: 213, name: 'Underground Assault', minLevel: 15, faction: 'Alliance', questGiver: 'Shoni the Shilent', questLocation: 'Stormwind' },
    ],
  },
  {
    id: 'shadowfang-keep',
    name: 'Shadowfang Keep',
    zone: 'Silverpine Forest',
    zoneId: 130,
    levelRange: [22, 30],
    recommendedLevel: 25,
    faction: 'Neutral',
    overviewGuideId: 34945,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/shadowfang-keep-overview',
    quests: [
      { id: 1014, name: 'The Book of Ur', minLevel: 16, faction: 'Both', questGiver: 'Keeper Bel\'dugur', questLocation: 'Undercity' },
      { id: 1013, name: 'Arugal Must Die', minLevel: 18, faction: 'Horde', questGiver: 'Dalar Dawnweaver', questLocation: 'Sepulcher' },
      { id: 1098, name: 'Deathstalkers in Shadowfang', minLevel: 18, faction: 'Horde', questGiver: 'High Executor Hadrec', questLocation: 'Sepulcher' },
    ],
  },
  {
    id: 'blackfathom-deeps',
    name: 'Blackfathom Deeps',
    zone: 'Ashenvale',
    zoneId: 331,
    levelRange: [24, 32],
    recommendedLevel: 26,
    faction: 'Neutral',
    overviewGuideId: 34933,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/blackfathom-deeps-overview',
    quests: [
      { id: 1205, name: 'Blackfathom Villainy', minLevel: 18, faction: 'Both', questGiver: 'Dawn\'s Reach / Sentinel', questLocation: 'Darnassus / Zoram' },
      { id: 1198, name: 'The Twilight Falls', minLevel: 20, faction: 'Both', questGiver: 'Argent Guard Thaelrid', questLocation: 'Inside Dungeon' },
      { id: 6561, name: 'In Search of Thaelrid', minLevel: 18, faction: 'Alliance', questGiver: 'Dawnstrider', questLocation: 'Darnassus' },
      { id: 1218, name: 'Allegiance to the Old Gods', minLevel: 17, faction: 'Horde', questGiver: 'Je\'neu Sancrea', questLocation: 'Zoram\'gar' },
    ],
  },
  {
    id: 'the-stockade',
    name: 'The Stockade',
    zone: 'Stormwind City',
    zoneId: 1519,
    levelRange: [24, 32],
    recommendedLevel: 26,
    faction: 'Alliance',
    overviewGuideId: 34935,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/the-stockade-overview',
    quests: [
      { id: 386, name: 'Quell The Uprising', minLevel: 22, faction: 'Alliance', questGiver: 'Warden Thelwater', questLocation: 'Stormwind City' },
      { id: 387, name: 'The Color of Blood', minLevel: 22, faction: 'Alliance', questGiver: 'Nikova Raskol', questLocation: 'Stormwind City' },
      { id: 388, name: 'In Name of the Light', minLevel: 23, faction: 'Alliance', questGiver: 'Archbishop Benedictus', questLocation: 'Stormwind City' },
      { id: 389, name: 'Crime and Punishment', minLevel: 22, faction: 'Alliance', questGiver: 'Councilman Millstipe', questLocation: 'Darkshire' },
      { id: 390, name: 'The Stockade Riots', minLevel: 22, faction: 'Alliance', questGiver: 'Warden Thelwater', questLocation: 'Stormwind City' },
    ],
  },
  {
    id: 'hall-of-thanes',
    name: 'The Hall of Thanes',
    zone: 'Dun Morogh / Ironforge Deep',
    levelRange: [28, 35],
    recommendedLevel: 31,
    faction: 'Neutral',
    overviewGuideId: 34887,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/hall-of-thanes-overview',
    quests: [
      { name: 'Secrets of the Thanes', minLevel: 26, faction: 'Both', questLocation: 'Ironforge / Foothills' },
      { name: 'Runic Desecration', minLevel: 27, faction: 'Both', questLocation: 'Outside Dungeon' },
    ],
  },
  {
    id: 'city-of-dalaran',
    name: 'City of Dalaran',
    zone: 'Hillsbrad Foothills',
    levelRange: [30, 38],
    recommendedLevel: 34,
    faction: 'Neutral',
    overviewGuideId: 34964,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/city-of-dalaran-overview',
    quests: [
      { name: 'Breaching the Bubble', minLevel: 28, faction: 'Both', questLocation: 'Hillsbrad Foothills' },
      { name: 'Remnants of the Kirin Tor', minLevel: 29, faction: 'Both', questLocation: 'Ambermill' },
    ],
  },
  {
    id: 'excavation-site',
    name: 'Excavation Site: Wetlands',
    zone: 'Wetlands',
    levelRange: [32, 40],
    recommendedLevel: 36,
    faction: 'Neutral',
    overviewGuideId: 34967,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/excavation-site-overview',
    quests: [
      { name: 'Unearthing the Past', minLevel: 30, faction: 'Both', questLocation: 'Menethil Harbor' },
      { name: 'Dark Iron Infiltration', minLevel: 31, faction: 'Both', questLocation: 'Wetlands' },
    ],
  },
  {
    id: 'gnomeregan',
    name: 'Gnomeregan',
    zone: 'Dun Morogh',
    levelRange: [29, 38],
    recommendedLevel: 32,
    faction: 'Neutral',
    overviewGuideId: 34940,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/gnomeregan-overview',
    quests: [
      { id: 2841, name: 'The Death Ledger', minLevel: 25, faction: 'Both', questLocation: 'Tinkertown' },
      { id: 2928, name: 'Essential Artificials', minLevel: 24, faction: 'Both', questLocation: 'Tinkertown' },
      { id: 2930, name: 'Data Rescue', minLevel: 25, faction: 'Both', questLocation: 'Tinkertown' },
      { id: 2844, name: 'Grime-Encrusted Ring', minLevel: 25, faction: 'Both', questLocation: 'Inside Dungeon' },
    ],
  },
  {
    id: 'scarlet-monastery',
    name: 'Scarlet Monastery (Graveyard, Library, Armory, Cathedral)',
    zone: 'Tirisfal Glades',
    levelRange: [30, 45],
    recommendedLevel: 36,
    faction: 'Neutral',
    overviewGuideId: 34952,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/scarlet-monastery-overview',
    quests: [
      { id: 1048, name: 'In the Name of the Light', minLevel: 34, faction: 'Both', questLocation: 'Desolace / Southshore' },
      { id: 1053, name: 'Compendium of the Fallen', minLevel: 28, faction: 'Horde', questLocation: 'Thunder Bluff' },
      { id: 1049, name: 'Hearts of Zeal', minLevel: 30, faction: 'Horde', questLocation: 'Undercity' },
      { id: 1050, name: 'Test of Lore', minLevel: 25, faction: 'Horde', questLocation: 'Undercity' },
    ],
  },
  {
    id: 'razorfen-kraul',
    name: 'Razorfen Kraul',
    zone: 'Southern Barrens',
    levelRange: [30, 40],
    recommendedLevel: 33,
    faction: 'Neutral',
    overviewGuideId: 34950,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/razorfen-kraul-overview',
    quests: [
      { id: 1102, name: 'Blueleaf Tubers', minLevel: 20, faction: 'Both', questLocation: 'Ratchet' },
      { id: 1109, name: 'Going, Going, Guano!', minLevel: 30, faction: 'Horde', questLocation: 'Thunder Bluff' },
      { id: 1144, name: 'Willix the Importer', minLevel: 22, faction: 'Both', questLocation: 'Inside Dungeon' },
    ],
  },
  {
    id: 'razorfen-downs',
    name: 'Razorfen Downs',
    zone: 'Thousand Needles',
    levelRange: [37, 46],
    recommendedLevel: 40,
    faction: 'Neutral',
    overviewGuideId: 34949,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/razorfen-downs-overview',
    quests: [
      { id: 1105, name: 'A Host of Evil', minLevel: 35, faction: 'Both', questLocation: 'Thousand Needles' },
      { id: 1106, name: 'Bring the End', minLevel: 37, faction: 'Horde', questLocation: 'Undercity' },
    ],
  },
  {
    id: 'karazhan-crypts',
    name: 'Karazhan Crypts',
    zone: 'Deadwind Pass',
    levelRange: [58, 60],
    recommendedLevel: 60,
    faction: 'Neutral',
    overviewGuideId: 34969,
    guideUrl: 'https://www.wowhead.com/forever/guide/dungeons/karazhan-crypts-overview',
    quests: [
      { name: 'Whispers from the Tomb', minLevel: 58, faction: 'Both', questLocation: 'Morgan\'s Plot' },
      { name: 'Creeping Malison', minLevel: 58, faction: 'Both', questLocation: 'Inside Crypts' },
    ],
  },
];

export function findDungeons(options: {
  level?: number;
  faction?: 'Alliance' | 'Horde' | 'Both';
  searchQuery?: string;
} = {}): ForeverDungeon[] {
  let list = FOREVER_DUNGEONS;

  if (options.level !== undefined) {
    const lvl = options.level;
    list = list.filter((d) => lvl >= d.levelRange[0] - 2 && lvl <= d.levelRange[1] + 2);
  }

  if (options.faction && options.faction !== 'Both') {
    list = list.filter((d) => d.faction === 'Neutral' || d.faction === options.faction);
  }

  if (options.searchQuery) {
    const q = options.searchQuery.toLowerCase();
    list = list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.zone.toLowerCase().includes(q) ||
        d.quests.some((quest) => quest.name.toLowerCase().includes(q))
    );
  }

  return list;
}
