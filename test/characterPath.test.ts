import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterPath } from '../src/blizzard/endpoints/types.js';

const EQUIPMENT = 'profile/wow/character/{realmSlug}/{characterName}/equipment';

describe('buildCharacterPath', () => {
  it('uses realm + name for retail', () => {
    assert.equal(
      buildCharacterPath(EQUIPMENT, { realmSlug: 'Area-52', characterName: 'Thrall' }, 'retail'),
      'profile/wow/character/area-52/thrall/equipment',
    );
  });

  it('requires realmSlug for retail and classic', () => {
    for (const game of ['retail', 'classic'] as const) {
      assert.throws(
        () => buildCharacterPath(EQUIPMENT, { characterName: 'Thrall' }, game),
        /realmSlug is required/,
      );
    }
  });

  it('uses the name-surname slug without a realm for Forever', () => {
    assert.equal(
      buildCharacterPath(EQUIPMENT, { characterName: 'doja-zap' }, 'forever'),
      'profile/wow/character/doja-zap/equipment',
    );
  });

  it('combines characterName and surname for Forever, ignoring realmSlug', () => {
    assert.equal(
      buildCharacterPath(
        EQUIPMENT,
        { characterName: 'Doja', surname: 'Zap', realmSlug: 'ignored' },
        'forever',
      ),
      'profile/wow/character/doja-zap/equipment',
    );
  });

  it('keeps extra path params after the character', () => {
    assert.equal(
      buildCharacterPath(
        'profile/wow/character/{realmSlug}/{characterName}/pvp-bracket/{pvpBracket}',
        { characterName: 'Doja', surname: 'Zap', pvpBracket: '2v2' },
        'forever',
      ),
      'profile/wow/character/doja-zap/pvp-bracket/2v2',
    );
  });

  it('leaves non-character paths alone', () => {
    assert.equal(
      buildCharacterPath('data/wow/realm/{realmSlug}', { realmSlug: 'tichondrius' }, 'forever'),
      'data/wow/realm/tichondrius',
    );
  });
});
