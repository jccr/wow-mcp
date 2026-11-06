import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseItemSources, parseQuestPage, parseZoneQuests } from '../src/wowhead/pageParser.js';
import { checkUsability, compareItems, parseItemXmlInfo } from '../src/wowhead/itemInfo.js';
import { filterZoneQuests, findRewardCandidates } from '../src/wowhead/questRewards.js';

// Trimmed from live Wowhead Forever responses (2026-11-06)
const goblinSmasherXml = `<?xml version="1.0" encoding="UTF-8"?><wowhead><item id="4964"><name><![CDATA[Goblin Smasher]]></name>
<json><![CDATA["classs":2,"displayName":"Goblin Smasher","dps":8.23,"id":4964,"level":12,"name":"Goblin Smasher","quality":2,"reqlevel":5,"reqrace":32,"side":2,"slot":17,"slotbak":17,"source":[4],"speed":3.10,"subclass":5]]></json>
<jsonEquip><![CDATA["dmgmax1":31,"dmgmin1":20,"dps":8.23,"mledps":8.23,"mlespeed":3.10,"races":32,"sellprice":503,"speed":3.10,"str":2]]></jsonEquip></item></wowhead>`;

const staffOfOrgrimmarXml = `<wowhead><item id="15444">
<json><![CDATA["classs":2,"displayName":"Staff of Orgrimmar","dps":11.82,"id":15444,"level":18,"name":"Staff of Orgrimmar","quality":3,"reqlevel":9,"side":2,"slot":17,"slotbak":17,"speed":3.30,"subclass":10]]></json>
<jsonEquip><![CDATA["agi":6,"dmgmax1":47,"dmgmin1":31,"dps":11.82,"int":6,"mledps":11.82,"mlespeed":3.30,"sellprice":1614,"speed":3.30,"spldmg":18,"splheal":18]]></jsonEquip></item></wowhead>`;

const makeshiftStormcallerXml = `<wowhead><item id="281274">
<json><![CDATA["classs":2,"displayName":"Makeshift Stormcaller","dps":5.76,"id":281274,"level":11,"name":"Makeshift Stormcaller","quality":2,"slot":17,"speed":3.30,"subclass":10]]></json>
<jsonEquip><![CDATA["dps":5.76,"int":2,"mledps":5.76,"mlespeed":3.30]]></jsonEquip></item></wowhead>`;

const totemXml = `<wowhead><item id="263412">
<json><![CDATA["armor":0,"classs":4,"displayName":"Totem of Charged Flames","id":263412,"level":10,"name":"Totem of Charged Flames","quality":2,"reqclass":64,"reqlevel":10,"slot":28,"slotbak":28,"subclass":9]]></json>
<jsonEquip><![CDATA[]]></jsonEquip></item></wowhead>`;

describe('Item info parsing', () => {
  it('parses type, slot, DPS, stats and race restriction from item XML', () => {
    const info = parseItemXmlInfo(goblinSmasherXml);
    assert.ok(info);
    assert.equal(info.id, 4964);
    assert.equal(info.itemClass, 'Weapon');
    assert.equal(info.subclass, 'Two-Handed Mace');
    assert.equal(info.slot, 'Two-Hand');
    assert.equal(info.dps, 8.23);
    assert.equal(info.speed, 3.1);
    assert.equal(info.damageMin, 20);
    assert.equal(info.damageMax, 31);
    assert.deepEqual(info.stats, { strength: 2 });
    assert.deepEqual(info.races, ['Tauren']);
    assert.equal(info.classes, undefined);
    assert.equal(info.requiredLevel, 5);
  });

  it('parses spell power stats and class restrictions', () => {
    const staff = parseItemXmlInfo(staffOfOrgrimmarXml)!;
    assert.deepEqual(staff.stats, { agility: 6, intellect: 6, spellDamage: 18, spellHealing: 18 });
    const totem = parseItemXmlInfo(totemXml)!;
    assert.equal(totem.subclass, 'Totem');
    assert.deepEqual(totem.classes, ['Shaman']);
  });

  it('returns undefined for non-item payloads', () => {
    assert.equal(parseItemXmlInfo('<html>challenge</html>'), undefined);
  });
});

describe('Usability checks', () => {
  const trollShaman = { className: 'shaman', race: 'Troll', level: 15 };

  it('blocks race-restricted and talent-gated weapons with reasons', () => {
    const smasher = parseItemXmlInfo(goblinSmasherXml)!;
    const result = checkUsability(smasher, trollShaman);
    assert.equal(result.usable, false);
    assert.ok(result.reasons.some((r) => r.includes('Tauren')));
    assert.ok(result.reasons.some((r) => r.includes('requires a talent')));
  });

  it('allows talent-gated weapons when requested', () => {
    const smasher = parseItemXmlInfo(goblinSmasherXml)!;
    const result = checkUsability(smasher, { ...trollShaman, race: 'Tauren', includeTalentGated: true });
    assert.equal(result.usable, true);
  });

  it('accepts class-appropriate items and enforces level', () => {
    const staff = parseItemXmlInfo(staffOfOrgrimmarXml)!;
    assert.equal(checkUsability(staff, trollShaman).usable, true);
    const result = checkUsability(staff, { ...trollShaman, level: 8 });
    assert.equal(result.usable, false);
    assert.ok(result.reasons[0].includes('level 9'));
  });

  it('treats cloaks (armor subclass -6) as wearable by every class', () => {
    const cloakXml = `<wowhead><item id="5314"><json><![CDATA["armor":17,"classs":4,"id":5314,"level":20,"name":"Boar Hunter's Cape","quality":2,"reqlevel":14,"slot":16,"subclass":-6]]></json><jsonEquip><![CDATA["agi":3,"armor":17]]></jsonEquip></item></wowhead>`;
    const cloak = parseItemXmlInfo(cloakXml)!;
    assert.equal(cloak.subclass, 'Cloak');
    assert.equal(checkUsability(cloak, trollShaman).usable, true);
    assert.equal(checkUsability(cloak, { className: 'mage', level: 20 }).usable, true);
  });

  it('enforces class masks and proficiency for other classes', () => {
    const totem = parseItemXmlInfo(totemXml)!;
    assert.equal(checkUsability(totem, { className: 'mage' }).usable, false);
    const staff = parseItemXmlInfo(staffOfOrgrimmarXml)!;
    assert.equal(checkUsability(staff, { className: 'rogue' }).usable, false);
  });
});

describe('Item comparison', () => {
  it('computes DPS and stat deltas against the equipped item', () => {
    const staff = parseItemXmlInfo(staffOfOrgrimmarXml)!;
    const current = parseItemXmlInfo(makeshiftStormcallerXml)!;
    const cmp = compareItems(staff, current);
    assert.equal(cmp.dpsDelta, 6.06);
    assert.equal(cmp.speedDelta, 0);
    assert.equal(cmp.itemLevelDelta, 7);
    assert.deepEqual(cmp.statDeltas, { agility: 6, intellect: 4, spellDamage: 18, spellHealing: 18 });
    assert.deepEqual(cmp.notes, []);
  });
});

describe('Vendor cost parsing', () => {
  it('reads nested cost arrays and treats -1 stock as unlimited', () => {
    const html = `<script>new Listview({template: 'npc', id: 'sold-by', data: [{"id":3314,"name":"Urtharo","tag":"Weapons Merchant","location":[1637],"react":[null,1],"stock":-1,"cost":[[3181]]}]});</script>`;
    const result = parseItemSources(html);
    assert.ok(result.soldBy);
    assert.equal(result.soldBy[0].cost, 3181);
    assert.equal(result.soldBy[0].costFormatted, '31s 81c');
    assert.equal(result.soldBy[0].stock, undefined);
    assert.equal(result.soldBy[0].tag, 'Weapons Merchant');
  });
});

describe('Quest page chain and infobox', () => {
  const questHtml = `<script>var g_pageInfo = {"type":5,"typeId":5730,"name":"Hidden Enemies"};</script>
    <table class="series"><tr><th>1.</th><td><div><a href="/forever/quest=5727/hidden-enemies">Hidden Enemies</a></div></td></tr><tr><th>2.</th><td><div><a href="/forever/quest=5728/hidden-enemies">Hidden Enemies</a></div></td></tr><tr><th>3.</th><td><div><a href="/forever/quest=5729/hidden-enemies">Hidden Enemies</a></div></td></tr><tr><th>4.</th><td><div><b>Hidden Enemies</b></div></td></tr></table>
    <script>WH.markup.printHtml("[ul][li]Level: 16[\\/li][li]Requires level 9[\\/li][li]Side: [span class=icon-horde]Horde[\\/span][\\/li][li][icon name=quest-start]Start: [url=\\/forever\\/npc=3216\\/neeru-fireblade]Neeru Fireblade[\\/url][\\/icon][\\/li][li][icon name=quest-end]End: [url=\\/forever\\/npc=4949\\/thrall]Thrall[\\/url][\\/icon][\\/li][li]Sharable[\\/li][\\/ul]", "infobox-contents-0", {});</script>
    <h2 class="heading-size-3">Rewards</h2>You will be able to choose one of these rewards:
    <table class="icontab icontab-box" id="choicerewards">
    <tr><th id="icontab-icon1"></th><td><span class="q3"><a href="/forever/item=15444/staff-of-orgrimmar">Staff of Orgrimmar</a></span></td></tr></table>
    See if you've already completed this`;

  it('parses the series with previous/next/final steps for the last step', () => {
    const parsed = parseQuestPage(questHtml, 5730);
    assert.equal(parsed.isQuestPage, true);
    assert.ok(parsed.chain);
    assert.equal(parsed.chain.steps.length, 4);
    assert.equal(parsed.chain.previousQuestId, 5729);
    assert.equal(parsed.chain.nextQuestId, undefined);
    assert.equal(parsed.chain.finalQuestId, 5730);
    assert.equal(parsed.chain.steps[3].current, true);
  });

  it('parses the series from a middle step', () => {
    const middle = questHtml
      .replace('<a href="/forever/quest=5728/hidden-enemies">Hidden Enemies</a>', '<b>Hidden Enemies</b>')
      .replace('<div><b>Hidden Enemies</b></div></td></tr></table>', '<div><a href="/forever/quest=5730/hidden-enemies">Hidden Enemies</a></div></td></tr></table>');
    const chain = parseQuestPage(middle, 5728).chain!;
    assert.equal(chain.previousQuestId, 5727);
    assert.equal(chain.nextQuestId, 5729);
    assert.equal(chain.finalQuestId, 5730);
  });

  it('parses level, required level, side, start/end NPCs from the infobox', () => {
    const { info } = parseQuestPage(questHtml, 5730);
    assert.deepEqual(info, {
      level: 16,
      requiredLevel: 9,
      side: 'Horde',
      startNpc: { id: 3216, name: 'Neeru Fireblade' },
      endNpc: { id: 4949, name: 'Thrall' },
      sharable: true,
    });
  });

  it('reads XP from quests that only have a Gains section', () => {
    const html = `<script>var g_pageInfo = {"type":5,"typeId":878,"name":"Tribes at War"};</script>
      <h2 class="heading-size-3">Gains</h2>Upon completion of this quest you will gain:
      <ul><li><div id="quest-reward-xp"></div></li></ul>
      <script>WH.Wow.Quest.setupScalingRewards({"minLevel":21,"maxLevel":21,"xp":{"multiplier":1,"levels":{"21":2100}},"coin":{"rewardAtCap":0,"multiplier":1,"levels":{"21":0}}});</script>
      See if you've already completed this`;
    const parsed = parseQuestPage(html, 878);
    assert.equal(parsed.experience, 2100);
    assert.equal(parsed.items, undefined);
  });

  it('lists each reward item once even when linked twice', () => {
    const html = `<h2 class="heading-size-3">Rewards</h2>You will be able to choose one of these rewards:
      <td><a href="/forever/item=10919/apothecary-gloves">Apothecary Gloves</a></td>
      <td><a href="/forever/item=270008/heat-resistant-mitts">Heat Resistant Mitts</a></td>
      <td><a href="/forever/item=10919/apothecary-gloves">Apothecary Gloves</a></td>
      See if you've already completed this`;
    assert.deepEqual(parseQuestPage(html, 962).items?.map((i) => i.id), [10919, 270008]);
  });

  it('flags non-quest pages so missing rewards are not reported as "none"', () => {
    assert.equal(parseQuestPage('<html><body>Verifying you are human</body></html>', 5730).isQuestPage, false);
  });
});

describe('Zone quests and reward search', () => {
  const zoneHtml = `<script>var g_pageInfo = {"type":7,"typeId":215,"name":"Mulgore"};</script>
    <script>new Listview({template: 'quest', id: 'quests', data: [
      {"category":215,"id":746,"itemchoices":[[4969,1],[4970,1]],"level":8,"name":"Dwarven Digging","reprewards":[[81,100]],"reqlevel":6,"side":2,"xp":700},
      {"category":215,"id":760,"itemchoices":[[3443,1],[4961,1]],"level":10,"name":"Wildmane Cleansing","reqlevel":7,"side":2,"xp":1050},
      {"category":215,"id":765,"itemchoices":[[4974,1],[4964,1]],"level":10,"name":"Supervisor Fizsprocket","reqlevel":6,"side":2,"xp":910},
      {"category":215,"id":999,"itemchoices":[[15444,1]],"level":20,"name":"Alliance Only","reqlevel":18,"side":1,"xp":100},
      {"category":215,"id":745,"itemrewards":[[4960,25]],"level":8,"money":225,"name":"Sharing the Land","reqlevel":1,"side":2,"xp":700}
    ]});</script>
    <script>new Listview({template: 'item', id: 'quest-rewards', data: [
      {"classs":4,"id":4969,"level":10,"name":"Fortified Bindings","quality":1,"reqlevel":5,"slot":9,"subclass":3,"armor":40},
      {"classs":4,"id":4970,"level":10,"name":"Rough-hewn Kodo Leggings","quality":1,"reqlevel":5,"slot":7,"subclass":2,"armor":60},
      {"classs":2,"id":3443,"level":10,"name":"Ceremonial Tomahawk","quality":1,"slot":21,"subclass":0,"dps":4.41,"speed":1.7},
      {"classs":2,"id":4961,"level":10,"name":"Dreamwatcher Staff","quality":1,"slot":17,"subclass":10,"dps":5.63,"speed":3.2},
      {"classs":2,"id":4974,"level":12,"name":"Compact Fighting Knife","quality":2,"slot":13,"subclass":15,"dps":6.33,"speed":1.5},
      {"classs":2,"id":4964,"level":12,"name":"Goblin Smasher","quality":2,"reqlevel":5,"reqrace":32,"slot":17,"subclass":5,"dps":8.23,"speed":3.1},
      {"classs":2,"id":15444,"level":18,"name":"Staff of Orgrimmar","quality":3,"reqlevel":9,"slot":17,"subclass":10,"dps":11.82,"speed":3.3}
    ]});</script>`;

  const page = parseZoneQuests(zoneHtml, 215);

  it('parses zone quests and reward item rows', () => {
    assert.equal(page.isZonePage, true);
    assert.equal(page.zoneName, 'Mulgore');
    assert.equal(page.quests.length, 5);
    const digging = page.quests.find((q) => q.id === 746)!;
    assert.deepEqual(digging.itemChoices, [{ id: 4969, count: 1 }, { id: 4970, count: 1 }]);
    assert.equal(digging.side, 'Horde');
    assert.deepEqual(digging.reputations, [{ factionId: 81, amount: 100 }]);
    assert.ok(page.rewardItems[4964]);
  });

  it('filters quests by faction and completed quests', () => {
    const quests = filterZoneQuests([page], { faction: 'Horde', excludeQuestIds: [746] });
    assert.deepEqual(quests.map((q) => q.id), [745, 760, 765]);
  });

  it('finds usable weapon rewards for a Troll Shaman, best DPS first', () => {
    const candidates = findRewardCandidates([page], {
      className: 'shaman',
      race: 'Troll',
      characterLevel: 15,
      faction: 'Horde',
      itemClass: 'weapon',
    });
    // Goblin Smasher (Tauren-only, talent-gated) and the Alliance quest are excluded
    assert.deepEqual(candidates.map((c) => c.item.name), ['Compact Fighting Knife', 'Dreamwatcher Staff', 'Ceremonial Tomahawk']);
    assert.equal(candidates[0].quest.id, 765);
    assert.equal(candidates[0].rewardType, 'choice');
  });

  it('lists unusable items with reasons when asked', () => {
    const candidates = findRewardCandidates([page], {
      className: 'shaman',
      race: 'Troll',
      characterLevel: 15,
      faction: 'Horde',
      itemClass: 'weapon',
      includeUnusable: true,
    });
    const smasher = candidates.find((c) => c.item.id === 4964)!;
    assert.equal(smasher.usable, false);
    assert.ok(smasher.unusableReasons!.some((r) => r.includes('Tauren')));
  });

  it('applies subclass and minimum DPS filters', () => {
    const candidates = findRewardCandidates([page], {
      className: 'shaman',
      characterLevel: 15,
      itemClass: 'weapon',
      subclasses: ['staff'],
      minDps: 5,
    });
    assert.deepEqual(candidates.map((c) => c.item.id), [4961]);
  });

  it('rejects non-zone pages', () => {
    assert.equal(parseZoneQuests('<html>challenge</html>', 215).isZonePage, false);
  });
});
