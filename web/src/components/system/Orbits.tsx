"use client";

import { PLANET_SYSTEM } from "@/lib/planets";

/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  YOUR TURN.                                                          │
 * │                                                                      │
 * │  Draw the faint ring showing each planet's orbital path. Pure        │
 * │  geometry, no animation — the safest place to feel how <group>       │
 * │  transforms work before Sprint 4 starts moving a camera along one.   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * THE BRIEF
 *   One flat ring per planet, centred on the sun, at that planet's
 *   orbitRadius. Faint — these are guides, not decoration.
 *
 * THE ONE CATCH (this is the lesson)
 *   Three.js builds <ringGeometry> standing upright in the XY plane, like a
 *   coin facing you. Your planets orbit in the XZ plane — flat, like a
 *   tabletop. So every ring needs rotating -90° about the X axis to lie down.
 *
 *   You could rotate all six rings individually. Don't. Wrap them in ONE
 *   <group rotation-x={-Math.PI / 2}> and every child inherits it. That is
 *   the same parent-child relationship Planet.tsx uses to orbit without
 *   trigonometry, applied to orientation instead of position.
 *
 * PIECES YOU NEED
 *   <ringGeometry args={[innerRadius, outerRadius, segments]} />
 *     A thin ring means inner and outer are nearly equal: r - 0.02 and
 *     r + 0.02. `segments` is how many straight edges approximate the
 *     circle — go too low and you get a visible hexagon. 96 is plenty.
 *
 *   <meshBasicMaterial />
 *     Basic, not standard: a guide line shouldn't respond to the sun.
 *     You'll want `transparent`, a low `opacity` (~0.15), and
 *     `side={THREE.DoubleSide}` so rings don't vanish when viewed from
 *     underneath. Import { DoubleSide } from "three" for that.
 *
 *   planet.accent is the colour to use. PLANET_SYSTEM is already imported —
 *   map over it, and use planet.id as the React key.
 *
 * WHEN IT WORKS
 *   Six faint rings, flat, each with its planet riding on top of it. If a
 *   ring is standing upright you skipped the rotation; if they disappear at
 *   certain camera angles you're missing DoubleSide.
 *
 * Returning null for now, so the scene still runs before you start.
 */
export default function Orbits() {
  return null;
}
