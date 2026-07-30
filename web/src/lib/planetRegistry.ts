import type { Object3D } from "three";

/**
 * Maps planet id -> its live Object3D in the scene.
 *
 * The camera needs a planet's *current* world position every frame, and that
 * position changes continuously as the planet orbits. Storing Object3D refs
 * in React state would mean re-rendering to read a value that changes 60x a
 * second anyway, so this is a plain module-level Map instead: written once on
 * mount, read imperatively inside useFrame.
 *
 * A planet's world position can't be derived from lib/planets.ts either — the
 * orbit lives in a parent group's rotation, so only the object itself knows
 * where it currently is (via getWorldPosition).
 */
const registry = new Map<string, Object3D>();

export function registerPlanet(id: string, object: Object3D) {
  registry.set(id, object);
}

export function unregisterPlanet(id: string) {
  registry.delete(id);
}

export function getPlanetObject(id: string): Object3D | undefined {
  return registry.get(id);
}
