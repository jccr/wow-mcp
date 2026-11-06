import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseItemSources, extractListviewsFromHtml, parseQuestPage } from '../src/wowhead/pageParser.js';

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

      new Listview({
        id: 'reagent-for',
        name: 'Reagent For',
        data: [
          {"id": 2149, "name": "Handstitched Leather Boots", "skill": 165, "skillname": "Leatherworking", "learnedat": 1}
        ]
      });

      new Listview({
        id: 'can-be-placed-in',
        name: 'Can be placed in',
        data: [
          {"id": 5764, "name": "Small Leather Backpack", "slots": 10, "quality": 1}
        ]
      });

      new Listview({
        id: 'see-also',
        name: 'See also',
        data: [
          {"id": 2318, "name": "Medium Leather", "quality": 1, "level": 20}
        ]
      });

      var lv_comments0 = [
        {
          "id": 14050,
          "date": "2026-05-10T12:00:00Z",
          "rating": 45,
          "user": "LeatherGuru",
          "body": "Best spot to farm this in Forever is Redridge Mountains from the dire wolves."
        }
      ];
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

    assert.ok(result.rawListviewsFound.includes('dropped-by'));
    assert.ok(result.rawListviewsFound.includes('skinned-from'));
    assert.ok(result.rawListviewsFound.includes('reagent-for'));
    assert.ok(result.rawListviewsFound.includes('can-be-placed-in'));
    assert.ok(result.rawListviewsFound.includes('see-also'));

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

    assert.ok(result.reagentFor);
    assert.equal(result.reagentFor.length, 1);
    assert.equal(result.reagentFor[0].name, 'Handstitched Leather Boots');

    assert.ok(result.canBePlacedIn);
    assert.equal(result.canBePlacedIn.length, 1);
    assert.equal(result.canBePlacedIn[0].name, 'Small Leather Backpack');

    assert.ok(result.seeAlso);
    assert.equal(result.seeAlso.length, 1);
    assert.equal(result.seeAlso[0].name, 'Medium Leather');

    assert.ok(result.comments);
    assert.equal(result.comments.length, 1);
    assert.equal(result.comments[0].user, 'LeatherGuru');
    assert.equal(result.comments[0].rating, 45);
    assert.ok(result.comments[0].body.includes('Redridge Mountains'));
  });

  it('parses quest rewards from quest page HTML', () => {
    const questHtml = `
      <h2 class="heading-size-2">Rewards</h2>You will receive:
      <table class="icontab icontab-box">
      <tr><th id="icontab-icon1"></th><td><span class="q2"><a href="/forever/item=5420/banshee-armor">Banshee Armor</a></span></td>
      </tr></table>
      <h2 class="heading-size-3">Gains</h2>Upon completion of this quest you will gain:
      <ul>
      <li><div><span>150</span> reputation with <a href="/forever/faction=76/orgrimmar">Orgrimmar</a></div></li></ul>
      <script>WH.Wow.Quest.setupScalingRewards({"minLevel":14,"maxLevel":14,"xp":{"multiplier":1,"levels":{"14":1250}},"coin":{"rewardAtCap":0,"multiplier":1,"levels":{"14":800}}});</script>
      See if you've already completed this
    `;

    const parsed = parseQuestPage(questHtml, 924);
    assert.equal(parsed.questId, 924);
    assert.ok(parsed.items);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].id, 5420);
    assert.equal(parsed.items[0].name, 'Banshee Armor');
    assert.equal(parsed.items[0].choice, false);
    assert.equal(parsed.experience, 1250);
    assert.equal(parsed.moneyCopper, 800);
    assert.ok(parsed.reputations);
    assert.equal(parsed.reputations.length, 1);
    assert.equal(parsed.reputations[0].factionId, 76);
    assert.equal(parsed.reputations[0].amount, 150);
  });
});
