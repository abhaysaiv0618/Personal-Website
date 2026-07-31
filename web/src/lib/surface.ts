import { Color, Vector3 } from "three";
import { CAMERA_FOV } from "./framing";
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

/**
 * Radius around the landing site kept clear of rocks.
 *
 * Raised from 7 in sprint 6, and it is doing real work now rather than just
 * keeping boulders out of your face. The content props stand on an arc at
 * PROP_RADIUS (lib/props.ts), and rocks are scattered without any knowledge of
 * them — so a clearing wide enough to contain the props is what stops a
 * monolith growing out of a boulder. One constant, rather than a
 * collision-rejection pass that would have to run every time either layout
 * changed.
 *
 * The two files must therefore agree, so props.ts imports this rather than
 * carrying its own copy of the number.
 */
export const CLEARING_RADIUS = 14;
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
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: turns a planet id into the integer seed above. */
export function hashId(id: string): number {
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
 * The Rocket model's own bounds, measured off the primitives in Rocket.tsx.
 * It's built around its fuselage rather than its base, so the base sits
 * *below* the origin and has to be added back to stand it on the ground.
 */
const ROCKET_BASE = 0.16;
const ROCKET_TOP = 0.84;
/** Widest point: the fins, not the body. */
const ROCKET_HALF_WIDTH = 0.28;

/**
 * What the sky fades toward as the rocket climbs out of the atmosphere.
 * Near-black rather than pure black so it sits against the CSS starfield
 * rather than reading as a hole punched in the page.
 */
export const SPACE_COLOR = "#05060a";

/** How high the rocket gets before the screen closes over it. */
const ASCENT_HEIGHT = 150;

/**
 * Height of the rocket above the pad, over the ascent.
 *
 * A pure function of progress rather than an integrated velocity, so the
 * rocket (drawn by SurfaceScene) and the camera chasing it (driven by Descent)
 * can compute it independently and get the same answer. Sharing a mutable
 * position through a registry would work too, but two readers of one pure
 * function cannot drift, and there is nothing to reset between launches.
 *
 * Exponent above 1 because a rocket leaves the pad slowly and then runs away
 * with itself — a linear climb reads as an elevator.
 */
export function rocketAscent(progress: number): number {
  return ASCENT_HEIGHT * Math.pow(Math.max(progress, 0), 2.2);
}

/**
 * How far below the rocket the camera trails once it starts following.
 *
 * Small on purpose. The rocket climbs vertically while the camera sits about
 * five units to one side, so a large vertical gap would leave the camera
 * staring almost straight up at a dot. Holding station just below it keeps the
 * rocket at a comfortable angle for the whole climb, and reads as flying up
 * alongside rather than being left behind on the ground.
 */
export const CHASE_GAP = 6;

/** Where we'd like the rocket, in degrees right of centre, given the room. */
const DESIRED_AZIMUTH_DEG = 16;
/** Fraction of the vertical half-frame the rocket should fill. */
const VERTICAL_FILL = 0.68;
/** Fraction of the horizontal half-frame left usable, as safety margin. */
const HORIZONTAL_SAFETY = 0.85;

const halfFovRad = (CAMERA_FOV / 2) * (Math.PI / 180);
const rocketBaseY = ROCKET_BASE * ROCKET_SCALE;
const rocketTopY = (ROCKET_BASE + ROCKET_TOP) * ROCKET_SCALE;
const rocketHalfWidth = ROCKET_HALF_WIDTH * ROCKET_SCALE;

/**
 * Distance is aspect-independent, so it's solved once.
 *
 * Standing at eye height, the *bottom* of the rocket is the extreme — further
 * below the eyeline than the nose is above it — so the fit is solved from that
 * and asked to fill a fixed fraction of the half-frame. 68% keeps it dominant
 * in shot with real margin top and bottom.
 */
const rocketDistance =
  Math.max(EYE_HEIGHT, rocketTopY - EYE_HEIGHT) /
  Math.tan(halfFovRad * VERTICAL_FILL);

/**
 * Where the rocket is parked, solved against the live viewport.
 *
 * It should sit to the *right* of centre rather than dead ahead — a vehicle
 * squarely in the middle of frame reads as a product shot, off to one side as
 * a place you arrived at. But how far right it can go is not a free choice.
 * Vertical FOV is fixed while horizontal FOV scales with aspect ratio, so a
 * monitor sees an 80-degree slice and a portrait phone barely 26. An offset
 * that composes nicely on a desktop walks straight off the edge of a phone —
 * and that failure is invisible until someone actually lands on one.
 *
 * Solving against the *narrowest supported* viewport is what the first version
 * did, and it's too conservative: it pinned every screen to the 4 degrees a
 * portrait phone can spare, which is why it read as dead centre everywhere.
 * Taking the aspect as an argument instead gives each viewport the offset it
 * can actually afford — the full 16 degrees on anything wider than about 1.3,
 * gracefully pulled back toward centre as the window narrows, and never
 * clipped.
 *
 * Returns −Z because that's the direction the camera faces when
 * SurfaceControls stands you up with yaw and pitch at zero, and +X is
 * screen-right from there.
 */
export function rocketPlacement(aspect: number): [number, number, number] {
  // Horizontal half-FOV for this viewport, less the angle the rocket itself
  // subtends — whatever remains is how far off-axis it may sit whole.
  const horizontalHalfFov = Math.atan(Math.tan(halfFovRad) * aspect);
  const budget =
    horizontalHalfFov * HORIZONTAL_SAFETY -
    Math.atan(rocketHalfWidth / rocketDistance);

  const azimuth = Math.max(
    0,
    Math.min((DESIRED_AZIMUTH_DEG * Math.PI) / 180, budget)
  );

  return [
    Math.sin(azimuth) * rocketDistance,
    rocketBaseY,
    -Math.cos(azimuth) * rocketDistance,
  ];
}
