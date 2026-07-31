"use client";

import { Canvas } from "@react-three/fiber";
import { PLANET_SYSTEM, SYSTEM_EXTENT, getPlanet } from "@/lib/planets";
import { CAMERA_FOV } from "@/lib/framing";
import { isInSpace, useSystemStore } from "@/lib/store";
import SurfaceControls from "@/components/surface/SurfaceControls";
import SurfaceScene from "@/components/surface/SurfaceScene";
import CameraRig from "./CameraRig";
import Descent from "./Descent";
import Flight from "./Flight";
import Orbits from "./Orbits";
import Planet from "./Planet";
import Starfield from "./Starfield";
import Sun from "./Sun";

export default function SolarSystem() {
  const clearFocus = useSystemStore((s) => s.clearFocus);
  const phase = useSystemStore((s) => s.phase);
  const focusedId = useSystemStore((s) => s.focusedId);
  const inSpace = isInSpace(phase);
  const landedOn = !inSpace ? getPlanet(focusedId ?? "") : undefined;

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
      {/* The whole solar system, hidden rather than unmounted while the
          visitor is standing on a surface.

          Unmounting would look equivalent and is not. Each planet's orbit is
          *integrated* — Planet.tsx accumulates `rotation.y += delta * speed`
          on a mutable object rather than deriving an angle from the clock — so
          unmounting resets every planet to its start angle and you return to a
          rearranged system. (Deriving from the clock instead is not free
          either: freezing orbits during a flight depends on integration, since
          you can't pause a shared clock without tracking accumulated time.)

          Hiding costs nothing. WebGLRenderer skips an invisible subtree
          entirely during projection, so both the draw calls and the Sun's
          pointLight contribution drop to zero, while useFrame keeps running
          and the planets keep orbiting. You come back to a system that carried
          on without you, which reads as alive rather than paused.

          One thing hiding does *not* buy: three's raycaster ignores
          `visible`, so these planets still hit-test while you're on a surface.
          That is handled by the phase guards in the store, not here. */}
      <group visible={inSpace}>
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
      </group>

      {/* The surface, mounted only while you're on one.

          Mounted at the swap rather than preloaded during the descent, because
          its `<color attach="background">` would paint over the starfield the
          moment it appeared. Building the geometry costs a frame or two — and
          those frames land behind an opaque veil, which is exactly the sort of
          cost the cut exists to absorb. If it ever becomes visible, preloading
          it invisible with the background attached separately is the fix, and
          that is a sprint 7 concern.

          SurfaceScene stays up through `departing` so there's a world beneath
          you while the veil closes again. SurfaceControls does not: lift-off
          is Descent's camera, and letting a drag turn the head mid-departure
          would be two owners writing the same object. */}
      {landedOn && <SurfaceScene planet={landedOn} />}
      {phase === "surface" && <SurfaceControls />}

      {/* Camera drivers render nothing, so they sit outside the visibility
          group — they must keep working across the cut in both directions.

          Order is not cosmetic: R3F runs useFrame callbacks in subscription
          order, so CameraRig goes last. It is the one that hands control back
          to the visitor, and it should always be reading a camera the others
          have finished writing. */}
      <Flight />
      <Descent />
      <CameraRig />
    </Canvas>
  );
}
