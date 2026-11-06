/**
 * NPC location helpers built on the `map` field of Wowhead NPC tooltips:
 *   { zone: 17, coords: { "0": [[44.8, 59]] } }   (keys are map floors)
 */

export interface MapPoint {
  x: number;
  y: number;
  floor?: number;
}

export interface NpcLocation {
  npcId: number;
  npcName?: string;
  zoneId?: number;
  zoneName?: string;
  /** Every known spawn point (0-100 map percentages). Empty for instanced NPCs without map pins. */
  coords: MapPoint[];
  /** TomTom-style waypoint command for the first spawn, e.g. "/way The Barrens 44.8 59.0". */
  waypoint?: string;
}

/** Flattens a tooltip `map` field into spawn points. Returns undefined when there is no map data. */
export function parseTooltipMap(map: unknown): { zoneId?: number; coords: MapPoint[] } | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const m = map as { zone?: unknown; coords?: unknown };
  const zoneId = typeof m.zone === 'number' ? m.zone : undefined;
  const coords: MapPoint[] = [];

  if (m.coords && typeof m.coords === 'object') {
    for (const [floorKey, points] of Object.entries(m.coords as Record<string, unknown>)) {
      if (!Array.isArray(points)) continue;
      const floor = Number(floorKey);
      for (const p of points) {
        if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
          coords.push({ x: p[0], y: p[1], floor: Number.isFinite(floor) && floor !== 0 ? floor : undefined });
        }
      }
    }
  }

  if (zoneId === undefined && coords.length === 0) return undefined;
  return { zoneId, coords };
}

export function formatWaypoint(zoneName: string | undefined, point: MapPoint | undefined): string | undefined {
  if (!zoneName || !point) return undefined;
  return `/way ${zoneName} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
}
