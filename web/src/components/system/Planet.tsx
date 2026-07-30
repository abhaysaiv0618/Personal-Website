"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { Planet as PlanetData } from "@/lib/planets";

/**
 * One orbiting planet.
 *
 * The whole orbit is two nested transforms and zero trigonometry:
 *
 *     <group rotation-y>          ← pivot, sits at the sun (0,0,0)
 *       <mesh position-x={r}>     ← body, pushed out along the pivot's X axis
 *
 * Spinning the pivot sweeps the body around a circle of radius r, because a
 * child's position is always expressed in its *parent's* coordinate space.
 * The obvious alternative — computing x = cos(t)*r, z = sin(t)*r yourself —
 * gives the identical result but stops scaling the moment anything nests
 * deeper (a moon orbiting a planet orbiting a sun is three lines here and a
 * matrix headache by hand).
 */
export default function Planet({ planet }: { planet: PlanetData }) {
  const pivotRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    // Orbit: rotate the pivot, and the body comes along for the ride.
    if (pivotRef.current) {
      pivotRef.current.rotation.y += delta * planet.orbitSpeed;
    }
    // Axial spin: the body turns in its own local space, completely
    // independent of the orbit happening above it in the tree.
    if (bodyRef.current) {
      bodyRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={pivotRef} rotation-y={planet.startAngle}>
      <mesh ref={bodyRef} position-x={planet.orbitRadius}>
        <icosahedronGeometry args={[planet.size, 1]} />
        <meshStandardMaterial
          color={planet.color}
          flatShading
          // A little self-illumination keeps the night side from going fully
          // black once the only light source is the sun at the centre.
          emissive={planet.color}
          emissiveIntensity={0.18}
          roughness={0.85}
        />
      </mesh>
    </group>
  );
}
