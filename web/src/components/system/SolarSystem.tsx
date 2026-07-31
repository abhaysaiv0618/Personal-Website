"use client";

import { Canvas } from "@react-three/fiber";
import { PLANET_SYSTEM, SYSTEM_EXTENT } from "@/lib/planets";
import { CAMERA_FOV } from "@/lib/framing";
import { useSystemStore } from "@/lib/store";
import CameraRig from "./CameraRig";
import Flight from "./Flight";
import Orbits from "./Orbits";
import Planet from "./Planet";
import Starfield from "./Starfield";
import Sun from "./Sun";

export default function SolarSystem() {
  const clearFocus = useSystemStore((s) => s.clearFocus);

  return (
    <Canvas
      // alpha keeps the canvas transparent so the existing CSS Cosmos3D
      // starfield shows through instead of a flat black rectangle.
      gl={{ alpha: true, antialias: true }}
      // Only a starting guess — CameraRig solves the real framing from the
      // live viewport on its first frame and snaps to it. far is generous
      // because that solved distance grows on narrow windows.
      camera={{
        position: [0, SYSTEM_EXTENT * 0.62, SYSTEM_EXTENT * 1.45],
        fov: CAMERA_FOV,
        far: SYSTEM_EXTENT * 30,
      }}
      // Cap pixel ratio at 2. A phone's native 3x renders 9x the pixels of 1x
      // for no perceptible gain, and it's the cheapest perf lever available.
      dpr={[1, 2]}
      // Fires when a click hits no object at all — clicking empty space is
      // the natural "deselect" gesture.
      onPointerMissed={() => clearFocus()}
    >
      {/* Just enough ambient to keep the far side of a planet readable. The
          sun's own pointLight does the real work; light coming from the
          centre is what makes the orbits legible. */}
      <ambientLight intensity={0.22} />

      <Starfield />
      <Sun />
      <Orbits />

      {/* Every planet comes from the array — nothing here knows there are
          six. Append to PLANETS in lib/planets.ts and it shows up. */}
      {PLANET_SYSTEM.map((planet) => (
        <Planet key={planet.id} planet={planet} />
      ))}

      <Flight />
      <CameraRig />
    </Canvas>
  );
}
