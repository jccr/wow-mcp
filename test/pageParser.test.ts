import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseItemSources, extractListviewsFromHtml } from '../src/wowhead/pageParser.js';

describe('Wowhead Page Parser (ListView tables)', () => {
  const sampleHtml = `
    <html>
    <head><title>Light Leather - Item - World of Warcraft</title></head>
    <body>
    <script>
      new Listview({
        id: 'dropped-by',
        name: 'Dropped By',
        data: [
          {"id": 2043, "name": "Prairie Wolf", "classification": 0, "level": [5, 6], "count": 120, "outof": 240, "location": [1]},
          {"id": 2044, "name": "Elder Prairie Wolf", "classification": 1, "level": 8, "percent": 65.5}
        ]
      });

      new Listview({
        id: 'skinned-from',
        name: 'Skinned From',
        data: [
          {"id": 2043, "name": "Prairie Wolf", "classification": 0, "level": [5, 6], "count": 180, "outof": 200}
        ]
      });
    </script>
    </body>
    </html>
  `;

  it('extracts raw Listview data arrays', () => {
    const listviews = extractListviewsFromHtml(sampleHtml);
    assert.ok(listviews['dropped-by']);
    assert.equal(listviews['dropped-by'].length, 2);
    assert.ok(listviews['skinned-from']);
    assert.equal(listviews['skinned-from'].length, 1);
  });

  it('normalizes dropped-by and skinned-from records', () => {
    const result = parseItemSources(sampleHtml);

    assert.deepEqual(result.rawListviewsFound, ['dropped-by', 'skinned-from']);
    assert.ok(result.droppedBy);
    assert.equal(result.droppedBy.length, 2);

    const wolf = result.droppedBy[0];
    assert.equal(wolf.id, 2043);
    assert.equal(wolf.name, 'Prairie Wolf');
    assert.equal(wolf.classificationName, 'Normal');
    assert.equal(wolf.minLevel, 5);
    assert.equal(wolf.maxLevel, 6);
    assert.equal(wolf.dropRatePercent, 50);

    const elderWolf = result.droppedBy[1];
    assert.equal(elderWolf.classificationName, 'Elite');
    assert.equal(elderWolf.dropRatePercent, 65.5);

    assert.ok(result.skinnedFrom);
    assert.equal(result.skinnedFrom.length, 1);
    assert.equal(result.skinnedFrom[0].dropRatePercent, 90);
  });
});
