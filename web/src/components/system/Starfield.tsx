"use client";

import { useMemo } from "react";
import { SYSTEM_EXTENT } from "@/lib/planets";

const STAR_COUNT = 3500;

/**
 * A shell of stars surrounding the system.
 *
 * The naive version — 3,500 <mesh> elements — costs 3,500 draw calls. A draw
 * call is one "here is a thing, please render it" round trip to the GPU, and
 * the overhead is per call regardless of how trivial the thing is. A few
 * hundred is comfortable; a few thousand kills the frame budget on its own.
 *
 * <points> collapses all of them into ONE call by handing the GPU a single
 * flat array of coordinates. The tradeoff is that every star must share one
 * material, which is why they vary in position but not colour.
 *
 * This is also why Cosmos3D (the CSS starfield) stays behind the canvas:
 * these stars sit in 3D space and parallax as the camera moves, while the CSS
 * layer is a flat backdrop. Two different jobs.
 */
export default function Starfield() {
  const positions = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    const inner = SYSTEM_EXTENT * 2.5;
    const outer = SYSTEM_EXTENT * 6;

    for (let i = 0; i < STAR_COUNT; i++) {
      // Sample a direction uniformly on a sphere. Picking the polar angle
      // straight from a uniform random would bunch stars at the poles, so
      // acos() corrects the distribution.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = inner + Math.random() * (outer - inner);

      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, []);

  return (
    // Opted out of hit-testing. Raycasting walks every raycastable object in
    // the scene on every pointer move; leaving 3,500 stars in that set would
    // mean 3,500 intersection tests per mousemove for objects nobody can
    // click. Cost per frame matters far more here than the draw call saving.
    <points raycast={() => null}>
      <bufferGeometry>
        {/* attach="attributes-position" is R3F wiring this array onto the
            geometry's `position` attribute — the same thing as calling
            geometry.setAttribute("position", ...) imperatively. */}
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        // Without sizeAttenuation every star is the same size on screen no
        // matter how far away it is, which flattens all sense of depth.
        sizeAttenuation
        color="#ffffff"
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}
