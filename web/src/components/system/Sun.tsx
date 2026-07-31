"use client";

import { SUN_CORONA_SCALE, SUN_RADIUS } from "@/lib/planets";

/**
 * The star at the centre — both the visible body and the scene's only real
 * light source.
 */
export default function Sun() {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[SUN_RADIUS, 3]} />
        {/* meshBasicMaterial ignores lighting entirely, which is exactly right
            for a star: it emits light rather than receiving it. Give it the
            meshStandardMaterial the planets use and it would render as a dark
            ball, because nothing is shining on it. */}
        <meshBasicMaterial color="#ffb450" />
      </mesh>

      {/* A slightly larger, transparent shell reads as corona. Cheaper and
          more controllable than a real bloom post-processing pass.

          The scale lives in lib/planets.ts because the orbit walk spaces
          Mercury off this glow rather than off the solid body — the two must
          not be able to disagree. */}
      <mesh scale={SUN_CORONA_SCALE}>
        <icosahedronGeometry args={[SUN_RADIUS, 3]} />
        <meshBasicMaterial color="#ff8c3c" transparent opacity={0.14} />
      </mesh>

      {/* Light radiating from the centre, so every planet's lit side faces
          the sun automatically as it orbits. decay={0} keeps intensity
          constant with distance — physically wrong, but the outer planets
          would otherwise fall off to near-black. */}
      <pointLight intensity={2.4} distance={0} decay={0} color="#ffd9a0" />
    </group>
  );
}
