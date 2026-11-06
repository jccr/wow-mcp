import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTooltip,
  getQualityName,
  normalizeEntityType,
  WowheadForeverClient,
  createWowheadServer,
} from '../src/wowhead/index.js';

describe('Wowhead Formatter', () => {
  it('formats quality names correctly', () => {
    assert.equal(getQualityName(0), 'Poor (Grey)');
    assert.equal(getQualityName(1), 'Common (White)');
    assert.equal(getQualityName(2), 'Uncommon (Green)');
    assert.equal(getQualityName(3), 'Rare (Blue)');
    assert.equal(getQualityName(4), 'Epic (Purple)');
    assert.equal(getQualityName(5), 'Legendary (Orange)');
    assert.equal(getQualityName(-1), undefined);
    assert.equal(getQualityName(undefined), undefined);
  });

  it('converts money spans to g, s, c', () => {
    const html = 'Sell Price: <span class="moneygold">25</span> <span class="moneysilver">50</span> <span class="moneycopper">75</span>';
    const formatted = formatTooltip(html);
    assert.ok(formatted.includes('25g'));
    assert.ok(formatted.includes('50s'));
    assert.ok(formatted.includes('75c'));
  });

  it('strips html comments and html tags', () => {
    const html = '<table><tr><td><!--ilvl-->Item Level 80</td><th><!--spd-->Speed 1.90</th></tr></table>';
    const formatted = formatTooltip(html);
    assert.ok(!formatted.includes('<!--'));
    assert.ok(!formatted.includes('<td>'));
    assert.ok(formatted.includes('Item Level 80'));
    assert.ok(formatted.includes('Speed 1.90'));
  });

  it('decodes HTML entities', () => {
    const html = 'Requires &quot;Thunderfury&quot; &amp; Level &gt; 50 &plusmn; 2';
    const formatted = formatTooltip(html);
    assert.equal(formatted, 'Requires "Thunderfury" & Level > 50 ± 2');
  });
});

describe('Wowhead Entity Normalization', () => {
  it('normalizes entity types and plurals', () => {
    assert.equal(normalizeEntityType('items'), 'item');
    assert.equal(normalizeEntityType('ITEM'), 'item');
    assert.equal(normalizeEntityType('spells'), 'spell');
    assert.equal(normalizeEntityType('quests'), 'quest');
    assert.equal(normalizeEntityType('npcs'), 'npc');
    assert.equal(normalizeEntityType('objects'), 'object');
    assert.equal(normalizeEntityType('zones'), 'zone');
    assert.equal(normalizeEntityType('item_set'), 'item-set');
    assert.equal(normalizeEntityType('itemsets'), 'item-set');
  });
});

describe('WowheadForeverClient', () => {
  const client = new WowheadForeverClient();

  it('generates correct web URLs for WoW Forever', () => {
    assert.equal(client.getWebUrl('item', 19019), 'https://www.wowhead.com/forever/item=19019');
    assert.equal(client.getWebUrl('spell', 133), 'https://www.wowhead.com/forever/spell=133');
    assert.equal(client.getWebUrl('zone', 16074), 'https://www.wowhead.com/forever/zone=16074');
  });

  it('performs live search queries against Wowhead Forever', async () => {
    const results = await client.search('thunderfury', { limit: 5 });
    assert.ok(results.length > 0);
    const item = results.find((r) => r.id === 19019 && r.typeName === 'Item');
    assert.ok(item, 'Thunderfury item should be in results');
    assert.equal(item.name, 'Thunderfury, Blessed Blade of the Windseeker');
    assert.equal(item.url, 'https://www.wowhead.com/forever/item=19019');
  });

  it('fetches and formats live item tooltips', async () => {
    const item = await client.getTooltip('item', 19019);
    assert.equal(item.id, 19019);
    assert.equal(item.type, 'item');
    assert.equal(item.name, 'Thunderfury, Blessed Blade of the Windseeker');
    assert.equal(item.quality, 5);
    assert.equal(item.qualityName, 'Legendary (Orange)');
    assert.ok(item.formattedTooltip.includes('Item Level 80'));
    assert.ok(item.formattedTooltip.includes('Chance on hit'));
  });

  it('fetches live spell tooltips', async () => {
    const spell = await client.getTooltip('spell', 133);
    assert.equal(spell.id, 133);
    assert.equal(spell.name, 'Fireball');
    assert.ok(spell.formattedTooltip.includes('Fireball'));
    assert.ok(spell.formattedTooltip.includes('Fire damage'));
  });

  it('performs end-to-end lookup with match and alternatives', async () => {
    const result = await client.lookup('Thunderfury', 'item');
    assert.ok(result.match);
    assert.equal(result.match.id, 19019);
    assert.ok(result.match.formattedTooltip.length > 0);
  });
});

describe('Wowhead MCP Server Registration', () => {
  it('creates server and registers all tools', () => {
    const server = createWowheadServer();
    assert.ok(server);
  });
});
