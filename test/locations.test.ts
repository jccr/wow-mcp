import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWaypoint, parseTooltipMap } from '../src/wowhead/locations.js';

describe('NPC tooltip map parsing', () => {
  it('flattens floor-keyed coordinates (Jorn Skyseer, live tooltip shape)', () => {
    const parsed = parseTooltipMap({ zone: 17, coords: { '0': [[44.8, 59]] } });
    assert.deepEqual(parsed, { zoneId: 17, coords: [{ x: 44.8, y: 59, floor: undefined }] });
  });

  it('keeps multiple spawns and non-zero floors', () => {
    const parsed = parseTooltipMap({ zone: 1637, coords: { '0': [[50, 50], [51.2, 49]], '2': [[10, 20]] } });
    assert.equal(parsed?.coords.length, 3);
    assert.deepEqual(parsed?.coords[2], { x: 10, y: 20, floor: 2 });
  });

  it('returns a zone with no coordinates for instanced NPCs (Bazzalan, live tooltip shape)', () => {
    assert.deepEqual(parseTooltipMap({ zone: 2437, coords: {} }), { zoneId: 2437, coords: [] });
  });

  it('returns undefined without map data', () => {
    assert.equal(parseTooltipMap(undefined), undefined);
    assert.equal(parseTooltipMap({}), undefined);
  });

  it('formats a /way waypoint', () => {
    assert.equal(formatWaypoint('The Barrens', { x: 44.8, y: 59 }), '/way The Barrens 44.8 59.0');
    assert.equal(formatWaypoint(undefined, { x: 1, y: 2 }), undefined);
    assert.equal(formatWaypoint('Ragefire Chasm', undefined), undefined);
  });
});
