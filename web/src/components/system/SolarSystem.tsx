"use client";

import { Canvas } from "@react-three/fiber";
import { PLANET_SYSTEM, SYSTEM_EXTENT } from "@/lib/planets";
import Orbits from "./Orbits";
import Planet from "./Planet";
import Starfield from "./Starfield";
import Sun from "./Sun";

export default function SolarSystem() {
  return (
    <Canvas
      // alpha keeps the canvas transparent so the existing CSS Cosmos3D
      // starfield shows through instead of a flat black rectangle.
      gl={{ alpha: true, antialias: true }}
      // Framed from the outermost orbit rather than a magic number, so
      // adding a seventh planet pulls the camera back on its own.
      camera={{
        position: [0, SYSTEM_EXTENT * 0.62, SYSTEM_EXTENT * 1.45],
        fov: 50,
        far: SYSTEM_EXTENT * 12,
      }}
      // Cap pixel ratio at 2. A phone's native 3x renders 9x the pixels of 1x
      // for no perceptible gain, and it's the cheapest perf lever available.
      dpr={[1, 2]}
    >
      {/* Just enough ambient to keep the far side of a planet readable. The
          sun's own pointLight (see Sun.tsx) does the real work now — which is
          why the directionalLight from Sprint 1 is gone. Light coming from
          the centre is what makes the orbits legible. */}
      <ambientLight intensity={0.22} />

      <Starfield />
      <Sun />
      <Orbits />

      {/* Every planet comes from the array — nothing here knows there are
          six. Append to PLANETS in lib/planets.ts and it shows up. */}
      {PLANET_SYSTEM.map((planet) => (
        <Planet key={planet.id} planet={planet} />
      ))}
    </Canvas>
  );
}
