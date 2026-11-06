import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WowheadForeverClient } from '../src/wowhead/client.js';

describe('Wowhead request throttling', () => {
  it('spaces out www.wowhead.com requests', async () => {
    const client = new WowheadForeverClient({ minIntervalMs: 60, cookie: 'aws-waf-token=test' });
    const start = Date.now();
    await Promise.all([1, 2, 3, 4].map(() => client.waitForSlot('https://www.wowhead.com/forever/quest=902')));
    // Four request starts need at least three intervals
    assert.ok(Date.now() - start >= 170, `elapsed ${Date.now() - start}ms`);
  });

  it('does not throttle the tooltip host', async () => {
    const client = new WowheadForeverClient({ minIntervalMs: 200 });
    const start = Date.now();
    await Promise.all([1, 2, 3].map(() => client.waitForSlot('https://nether.wowhead.com/tooltip/npc/3387')));
    assert.ok(Date.now() - start < 100);
  });

  it('can be disabled with a zero interval', async () => {
    const client = new WowheadForeverClient({ minIntervalMs: 0 });
    const start = Date.now();
    await Promise.all([1, 2, 3].map(() => client.waitForSlot('https://www.wowhead.com/forever/zone=17')));
    assert.ok(Date.now() - start < 50);
  });
});
