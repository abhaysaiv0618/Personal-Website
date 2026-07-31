import { Color, Vector3 } from "three";
import type { Planet } from "./planets";

/**
 * Everything about the ground you stand on, derived rather than authored.
 *
 * Adding a portfolio section is still a one-line change to lib/planets.ts —
 * that promise would break immediately if each planet needed a hand-authored
 * surface. So a world's palette comes from the two colours the entry already
 * carries, and its rock layout comes from a hash of its id. Append a planet
 * and it gets a distinct, stable world for free.
 *
 * "Stable" is the load-bearing word. The layout must be identical on every
 * visit and every reload, or a returning visitor gets a different planet under
 * the same name. That is why this uses a seeded generator rather than
 * Math.random() — the seed is the id, so the world *is* the id.
 */

/**
 * Where the surface scene lives, far below the solar system.
 *
 * The system is hidden while you're down here, not unmounted, so both scenes
 * occupy the same three.js scene at the same time. Putting a kilometre between
 * them means no accident — a stray light, a mis-set camera, a raycast — can
 * ever connect the two. It costs nothing: the camera is simply teleported
 * here behind the veil, and at that moment the distance is unobservable.
 */
export const SURFACE_ORIGIN = new Vector3(0, -1200, 0);

/** Standing eye height above the ground plane. */
export const EYE_HEIGHT = 1.7;

/**
 * Radius of the ground disc. Sized against the fog below rather than picked:
 * the rim has to fall well inside the distance at which fog is total, because
 * a visible edge to the world is the one thing that breaks the illusion
 * instantly.
 */
export const GROUND_RADIUS = 300;

/**
 * Exponential-squared fog density: opacity goes as 1 - exp(-(d·density)²).
 *
 * At 0.012 that reaches ~20% by 40 units — enough haze to give the rocks near
 * you depth — and ~99.99% by 250, which swallows the rim at 300 completely.
 * Exp2 rather than linear fog because atmosphere thickens with distance
 * rather than ramping evenly, and the difference is visible on a flat plane
 * where fog is doing all the depth cueing.
 */
export const FOG_DENSITY = 0.012;

/** Radius around the landing site kept clear of rocks. */
const CLEARING_RADIUS = 7;
/** How far out rocks are scattered. Beyond this the fog hides them anyway. */
const SCATTER_RADIUS = 95;
/** How many rocks per world. */
const ROCK_COUNT = 34;

/**
 * The four colours a world is painted with, all pulled out of the planet's own
 * `color` and `accent`.
 *
 * The sky is the accent lifted and desaturated, because a saturated sky reads
 * as a coloured filter over the scene rather than as air. The ground is the
 * body colour pushed darker, so standing on a planet looks like standing on
 * the thing you were just looking at from orbit — which is most of what makes
 * the cut believable, given that the two scenes share no geometry at all.
 */
export function surfacePalette(planet: Planet) {
  const sky = new Color(planet.accent).offsetHSL(0, -0.22, 0.16);
  const ground = new Color(planet.color).offsetHSL(0, -0.08, -0.06);
  const rock = ground.clone().offsetHSL(0.02, 0.04, -0.05);
  // The low sun is tinted toward the accent so shading picks up the planet's
  // identity on the lit faces, not just in the sky.
  const sunlight = new Color(planet.accent).offsetHSL(0, -0.3, 0.3);

  return { sky, ground, rock, sunlight };
}

/**
 * mulberry32 — a small, fast, well-distributed PRNG.
 *
 * The point of a *seeded* generator is reproducibility: same seed, same
 * sequence, forever. Math.random() cannot give that, so a world built with it
 * would rearrange itself on every render.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turns a planet id into the integer seed above. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rock = {
  position: [number, number, number];
  rotation: [number, number, number];
  radius: number;
  /** 0 or 1 subdivisions — a bit of silhouette variety for free. */
  detail: number;
};

/**
 * Scatter rocks across the plane, deterministically per planet.
 *
 * Two details that matter more than they look:
 *
 *  - Radius is drawn as sqrt(u) rather than u. Sampling radius uniformly packs
 *    points toward the centre, because a ring's area grows with r — the square
 *    root corrects for that and gives an even-looking field.
 *  - Every rock is sunk below the ground plane by a fraction of its own size.
 *    Objects resting exactly on a plane read as props placed on a floor;
 *    partially buried, they read as terrain.
 */
export function rockLayout(planet: Planet): Rock[] {
  const random = mulberry32(hashId(planet.id));
  const rocks: Rock[] = [];

  for (let i = 0; i < ROCK_COUNT; i++) {
    const angle = random() * Math.PI * 2;
    const radius =
      CLEARING_RADIUS +
      Math.sqrt(random()) * (SCATTER_RADIUS - CLEARING_RADIUS);
    // Bias toward small: a field of same-sized boulders looks manufactured.
    const size = 0.35 + Math.pow(random(), 2.2) * 2.6;

    rocks.push({
      position: [
        Math.cos(angle) * radius,
        -size * (0.3 + random() * 0.3),
        Math.sin(angle) * radius,
      ],
      rotation: [
        random() * Math.PI,
        random() * Math.PI * 2,
        random() * Math.PI,
      ],
      radius: size,
      detail: random() > 0.72 ? 1 : 0,
    });
  }

  return rocks;
}

/** Scaled up from the model's native ~1 unit so it reads as a vehicle. */
export const ROCKET_SCALE = 2.4;
/**
 * Bottom of the engine skirt in the Rocket model's own space. The model is
 * built around its fuselage rather than its base, so this is what has to be
 * added back — scaled — to stand it on the ground instead of sinking it.
 */
const ROCKET_BASE = 0.16;

/**
 * Where the rocket sits, relative to the landing site: off to one side and a
 * little ahead, so it's in shot the moment the veil opens without being the
 * thing you're staring at.
 */
export const ROCKET_OFFSET: [number, number, number] = [
  3.4,
  ROCKET_BASE * ROCKET_SCALE,
  -3.2,
];
