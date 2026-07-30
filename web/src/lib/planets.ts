// ============================================================================
// THE ONLY FILE YOU EDIT TO ADD A SECTION.
//
// Append one entry to PLANETS below and a fully working planet appears: it
// gets an orbit, a speed, a starting angle, a ring, a nav-ring button and a
// keyboard slot. Nothing here is hardcoded per planet — every spatial value
// is derived from the entry's position in the array, so inserting a planet
// in the middle re-spaces the whole system automatically.
// ============================================================================

/** What you actually author. Everything else is computed. */
export type PlanetDef = {
  /** Stable key. Used for routing, React keys and content lookup. */
  id: string;
  /** Shown on hover and in the nav ring. */
  label: string;
  /** Planet body colour. */
  color: string;
  /** Brighter partner colour for labels, rings and atmosphere glow. */
  accent: string;
  /** Optional radius override. Leave it out to accept the default. */
  size?: number;
};

// Colours carry over from the modal themes in the current GraphNav so the
// site still feels like itself: About=cyan, Experience=amber, Education=
// red/gold, Projects=green, Contact=purple. Resume is new (indigo, matching
// the header's focus rings).
export const PLANETS: PlanetDef[] = [
  { id: "about", label: "About Me", color: "#0e7490", accent: "#22d3ee" },
  { id: "experience", label: "Experience", color: "#b45309", accent: "#f59e0b" },
  { id: "education", label: "Education", color: "#b91c1c", accent: "#fde047" },
  { id: "projects", label: "Projects", color: "#15803d", accent: "#22c55e" },
  { id: "resume", label: "Resume", color: "#4338ca", accent: "#818cf8" },
  { id: "contact", label: "Contact", color: "#7e22ce", accent: "#c084fc" },
];

// ---------------------------------------------------------------------------
// Derivation constants — tuning the system means changing these, not the
// entries above.
// ---------------------------------------------------------------------------

/** Radius of the sun's body. */
export const SUN_RADIUS = 2.2;
/** Distance from the sun to the innermost orbit. */
const FIRST_ORBIT = 5.4;
/** Additional distance per planet outward. */
const ORBIT_GAP = 2.7;
/** Default planet radius before per-planet variation. */
const BASE_SIZE = 0.62;
/** Scales all orbital speeds at once. Raise for a livelier system. */
const SPEED_SCALE = 0.9;

/**
 * The golden angle (~137.5°). Spacing start angles by this constant means
 * planets never line up in a row, and — unlike a fixed 360/n split — the
 * distribution stays good no matter how many planets you add later.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** An authored PlanetDef plus everything computed from its index. */
export type Planet = Required<Omit<PlanetDef, "size">> & {
  size: number;
  index: number;
  orbitRadius: number;
  orbitSpeed: number;
  startAngle: number;
};

export const PLANET_SYSTEM: Planet[] = PLANETS.map((def, index) => {
  const orbitRadius = FIRST_ORBIT + index * ORBIT_GAP;

  return {
    ...def,
    index,
    orbitRadius,
    // Kepler, loosely: distant planets travel slower. Dividing by sqrt(r) is
    // the real relationship and it happens to look right — without it the
    // outer planets whip around and the system reads as a fairground ride.
    orbitSpeed: SPEED_SCALE / Math.sqrt(orbitRadius),
    startAngle: index * GOLDEN_ANGLE,
    // Gentle deterministic size variation so six planets don't look stamped
    // from one mould. Still honours an explicit `size` when given.
    size: def.size ?? BASE_SIZE * (1 + 0.18 * Math.sin(index * 1.7)),
  };
});

/** Outermost orbit — used to frame the camera and size the starfield. */
export const SYSTEM_EXTENT =
  PLANET_SYSTEM[PLANET_SYSTEM.length - 1].orbitRadius;

export function getPlanet(id: string): Planet | undefined {
  return PLANET_SYSTEM.find((p) => p.id === id);
}
