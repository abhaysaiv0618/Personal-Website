"use client";

import { DoubleSide } from "three";
import { PLANET_SYSTEM } from "@/lib/planets";

/** Half-width of a ring. Small gap between inner and outer radius = a line. */
const RING_THICKNESS = 0.02;
/** Straight edges approximating the circle. Below ~48 the polygon shows. */
const RING_SEGMENTS = 96;

/**
 * The faint guide ring under each planet's orbital path.
 *
 * Three.js builds ringGeometry standing upright in the XY plane, but the
 * system orbits flat in XZ. Rather than rotating six rings individually,
 * one parent <group> is rotated and every child inherits it — the same
 * parent/child inheritance Planet.tsx uses to orbit without trigonometry,
 * applied to orientation instead of position.
 */
export default function Orbits() {
  return (
    <group rotation-x={-Math.PI / 2}>
      {PLANET_SYSTEM.map((planet) => (
        <mesh key={planet.id}>
          <ringGeometry
            args={[
              planet.orbitRadius - RING_THICKNESS,
              planet.orbitRadius + RING_THICKNESS,
              RING_SEGMENTS,
            ]}
          />
          {/* Basic, not standard: a guide line shouldn't be lit by the sun.
              DoubleSide keeps rings visible from below — a plane rendered
              single-sided is invisible from behind. depthWrite off stops the
              near-transparent rings from occluding planets behind them. */}
          <meshBasicMaterial
            color={planet.accent}
            transparent
            opacity={0.16}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
