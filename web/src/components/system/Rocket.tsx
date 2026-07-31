"use client";

import { forwardRef, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

/**
 * A low-poly rocket assembled from primitives — no model file to download,
 * and it matches the faceted look of the planets for free.
 *
 * Not rendered during flight: the experience is first person, so the camera
 * *is* the rocket and there is nothing to look at from outside. Its one
 * appearance is parked on a surface after landing — which is why `engine`
 * exists. A parked rocket with its exhaust still burning reads as about to
 * take off, and the glow would be lighting the ground around your feet from a
 * vehicle that is switched off.
 *
 * Everything is built pointing along +Y, which is the default axis for cone
 * and cylinder geometry, so a caller that wants it aimed somewhere rotates the
 * whole group and nothing here needs to know about headings.
 */
const Rocket = forwardRef<Group, { color?: string; engine?: boolean }>(
  function Rocket({ color = "#e2e8f0", engine = true }, ref) {
  const flameRef = useRef<Mesh>(null);

  useFrame((state) => {
    // Flicker the exhaust. Driven off elapsed time rather than a random value
    // per frame so the pulse is smooth instead of strobing.
    if (!flameRef.current) return;
    const t = state.clock.elapsedTime;
    const stretch = 1 + Math.sin(t * 26) * 0.18 + Math.sin(t * 11) * 0.08;
    flameRef.current.scale.set(1, stretch, 1);
  });

  return (
    <group ref={ref}>
      {/* Nose */}
      <mesh position-y={0.62}>
        <coneGeometry args={[0.19, 0.44, 7]} />
        <meshStandardMaterial color="#f87171" flatShading roughness={0.6} />
      </mesh>

      {/* Fuselage */}
      <mesh position-y={0.2}>
        <cylinderGeometry args={[0.19, 0.19, 0.42, 7]} />
        <meshStandardMaterial color={color} flatShading roughness={0.55} />
      </mesh>

      {/* Engine skirt */}
      <mesh position-y={-0.08}>
        <cylinderGeometry args={[0.19, 0.24, 0.16, 7]} />
        <meshStandardMaterial color="#64748b" flatShading roughness={0.7} />
      </mesh>

      {/* Three fins, placed by rotating a group rather than by working out
          each fin's position — the same transform-hierarchy trick the orbits
          use, at a smaller scale. */}
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-y={(i / 3) * Math.PI * 2}>
          <mesh position={[0.2, -0.02, 0]} rotation-z={-0.24}>
            <boxGeometry args={[0.16, 0.28, 0.035]} />
            <meshStandardMaterial color="#f87171" flatShading roughness={0.6} />
          </mesh>
        </group>
      ))}

      {engine && (
        <>
          {/* Exhaust. Basic material so it glows at full brightness regardless
              of where the sun is — it emits light rather than receiving it. */}
          <mesh ref={flameRef} position-y={-0.34}>
            <coneGeometry args={[0.15, 0.4, 7]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
          <mesh position-y={-0.46} scale={0.62}>
            <coneGeometry args={[0.15, 0.4, 7]} />
            <meshBasicMaterial color="#fff7ed" transparent opacity={0.75} />
          </mesh>

          {/* Throws light on the rocket's own underside and anything it
              passes. */}
          <pointLight
            position={[0, -0.4, 0]}
            intensity={3}
            distance={6}
            color="#fbbf24"
          />
        </>
      )}
    </group>
  );
  }
);

export default Rocket;
