import { Color } from "three";
import type { Planet, SettlementKind, WeatherKind } from "./planets";
import { FOG_DENSITY, hashId, mulberry32 } from "./surface";

/**
 * What a world's weather and skyline actually are, as numbers.
 *
 * `lib/planets.ts` names them in one word each; everything quantitative lives
 * here. The split matters because the authored file is the one somebody edits
 * to add a section, and it should stay a list of decisions rather than a list
 * of constants.
 *
 * Both are still *derived from the planet* wherever they can be: particle
 * colour comes from the palette, so weather belongs to its world rather than
 * being a grey overlay dropped on top of six different places.
 */

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type WeatherProfile = {
  /** How many particles. Zero means the whole particle layer is skipped. */
  count: number;
  /** Metres per second, roughly, along each axis. Negative Y falls. */
  drift: [number, number, number];
  /** Sideways wander applied as a sine, so snow does not fall like rain. */
  sway: number;
  /** Point size in world units. */
  size: number;
  /** How opaque a particle is. Dust hangs; rain streaks. */
  opacity: number;
  /**
   * Multiplies the world's base fog. A dust storm is a visibility change first
   * and a particle effect second — without this the air stays clear and the
   * particles read as dirt on the lens.
   */
  fogScale: number;
  /** Strength of the drifting bands in the sky, 0–1. */
  bands: number;
  /** Whether this world gets lightning. */
  lightning: boolean;
};

const WEATHER: Record<WeatherKind, WeatherProfile> = {
  // Fine regolith hanging in the air and drifting sideways. Barely falls.
  dust: {
    count: 900,
    drift: [1.6, -0.25, 0.5],
    sway: 0.5,
    size: 0.09,
    opacity: 0.5,
    fogScale: 1.9,
    bands: 0.45,
    lightning: false,
  },
  // Fast, near-vertical, and thin. Long thin points read as streaks in motion.
  rain: {
    count: 1400,
    drift: [0.9, -14, 0.2],
    sway: 0,
    size: 0.05,
    opacity: 0.55,
    fogScale: 1.35,
    bands: 0.6,
    lightning: false,
  },
  // Slow, large, and wandering. The sway is what stops it looking like rain.
  snow: {
    count: 1000,
    drift: [0.5, -1.1, 0.3],
    sway: 1.3,
    size: 0.13,
    opacity: 0.85,
    fogScale: 1.5,
    bands: 0.35,
    lightning: false,
  },
  // Falls like snow, drifts like dust, and is darker than either.
  ash: {
    count: 800,
    drift: [1.1, -1.8, 0.4],
    sway: 0.9,
    size: 0.1,
    opacity: 0.6,
    fogScale: 2.1,
    bands: 0.5,
    lightning: false,
  },
  // Heavy, fast, sideways, and the only kind with lightning.
  storm: {
    count: 1500,
    drift: [4.5, -6, 1.2],
    sway: 0.6,
    size: 0.11,
    opacity: 0.55,
    fogScale: 2.4,
    bands: 0.85,
    lightning: true,
  },
  // No particles at all — but not "nothing". The sky still moves.
  clear: {
    count: 0,
    drift: [0, 0, 0],
    sway: 0,
    size: 0,
    opacity: 0,
    fogScale: 0.85,
    bands: 0.7,
    lightning: false,
  },
};

export function weatherProfile(planet: Planet): WeatherProfile {
  return WEATHER[planet.weather];
}

/** The world's base fog, before the ascent thins it. */
export function worldFogDensity(planet: Planet): number {
  return FOG_DENSITY * WEATHER[planet.weather].fogScale;
}

/**
 * What colour the weather is.
 *
 * Derived from the palette rather than fixed per kind, so Martian dust is
 * Martian and Saturnian snow is not the same white as Earth's. Rain and storm
 * take the sky (water reads as reflected sky); everything solid takes a
 * lightened ground.
 */
export function weatherColor(planet: Planet, sky: Color, ground: Color): Color {
  switch (planet.weather) {
    case "rain":
    case "storm":
      return sky.clone().offsetHSL(0, 0, 0.08);
    case "snow":
      return sky.clone().offsetHSL(0, -0.3, 0.25);
    case "ash":
      return ground.clone().offsetHSL(0, -0.2, -0.1);
    default:
      return ground.clone().offsetHSL(0, 0, 0.22);
  }
}

// ---------------------------------------------------------------------------
// The skyline
// ---------------------------------------------------------------------------

/**
 * How far out the settlement stands.
 *
 * Chosen against the fog rather than by eye, which is the whole trick. At the
 * base FOG_DENSITY of 0.012, 100 units is ~76% fogged and 130 is ~92% — so the
 * buildings resolve as pale shapes in haze rather than as models, and can be
 * boxes and cylinders while still reading as a city. It also puts them clear of
 * the rock field (SCATTER_RADIUS 95) and well inside the ground disc
 * (GROUND_RADIUS 300).
 *
 * Worlds with thicker weather push the far edge in, or their skyline would be
 * swallowed completely.
 */
const SKYLINE_NEAR = 100;
const SKYLINE_FAR = 130;
/** Buildings per world. Low, because most of them are barely visible. */
const SKYLINE_COUNT = 58;

export type Building = {
  position: [number, number, number];
  rotationY: number;
  /** Footprint, and height. Shape comes from the settlement kind. */
  width: number;
  depth: number;
  height: number;
  /** Chooses between the two instanced meshes: a box or a cylinder. */
  round: boolean;
};

type SettlementShape = {
  /** Height range, in world units. */
  height: [number, number];
  /** Footprint range. */
  girth: [number, number];
  /** Fraction of buildings drawn as cylinders rather than boxes. */
  roundness: number;
  /** How tightly the ring clusters, 0 = evenly spread, 1 = one dense town. */
  clustering: number;
};

const SETTLEMENT: Record<SettlementKind, SettlementShape> = {
  // Broken and irregular: nothing tall left standing.
  ruins: { height: [3, 12], girth: [4, 11], roundness: 0.25, clustering: 0.55 },
  // Squat hemispheres — read as pressurised habitats.
  domes: { height: [5, 11], girth: [8, 18], roundness: 0.9, clustering: 0.7 },
  // Tall and thin, the most obviously artificial silhouette.
  spires: { height: [18, 46], girth: [3, 7], roundness: 0.5, clustering: 0.6 },
  // Mixed heights, densely packed — an actual skyline.
  city: { height: [8, 40], girth: [5, 13], roundness: 0.2, clustering: 0.75 },
  // Wide and low, floating slabs above a cloud deck.
  platforms: { height: [4, 9], girth: [14, 30], roundness: 0.35, clustering: 0.4 },
  none: { height: [0, 0], girth: [0, 0], roundness: 0, clustering: 0 },
};

/**
 * Lay out a settlement, deterministically per planet.
 *
 * Seeded off the id like the rocks and the props, so a world keeps its skyline
 * across reloads — the same reasoning as everywhere else: the world *is* the id.
 *
 * Clustering is the one non-obvious parameter. A ring of evenly spaced towers
 * reads as a fence around the horizon rather than as somewhere people live, so
 * the angle is pulled toward a few centres by a power curve. Higher clustering
 * means a denser town and emptier horizon either side of it.
 */
export function skylineLayout(planet: Planet): Building[] {
  const shape = SETTLEMENT[planet.settlement];
  if (shape.height[1] === 0) return [];

  const random = mulberry32(hashId(`${planet.id}:skyline`));
  const buildings: Building[] = [];

  // A few town centres to pull buildings toward.
  const centreCount = 2 + Math.floor(random() * 3);
  const centres = Array.from({ length: centreCount }, () => random() * Math.PI * 2);

  for (let i = 0; i < SKYLINE_COUNT; i++) {
    const centre = centres[Math.floor(random() * centres.length)];
    // Spread around that centre. Raising a signed uniform to a power keeps most
    // buildings near the centre while leaving a few stragglers out on their own.
    const offset = (random() - 0.5) * 2;
    const spread = Math.sign(offset) * Math.pow(Math.abs(offset), 1 + shape.clustering * 2);
    const angle = centre + spread * (1 - shape.clustering * 0.55) * 2.2;

    const radius = SKYLINE_NEAR + random() * (SKYLINE_FAR - SKYLINE_NEAR);
    const height = shape.height[0] + random() * (shape.height[1] - shape.height[0]);
    const girth = shape.girth[0] + random() * (shape.girth[1] - shape.girth[0]);

    buildings.push({
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
      rotationY: random() * Math.PI,
      width: girth,
      // Not square. A rectangular footprint gives every building a different
      // silhouette depending on which way it happens to face, which is most of
      // what stops fifty-eight boxes looking like fifty-eight of the same box.
      depth: girth * (0.6 + random() * 0.8),
      height,
      round: random() < shape.roundness,
    });
  }

  return buildings;
}
