"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function SpinningPlanet() {
  // Ref to the underlying THREE.Mesh so we can mutate its transform directly.
  // Driving rotation through useState would re-render the React tree 60x a
  // second for a value React never reads. Refs are the correct tool here.
  const meshRef = useRef<Mesh>(null);

  // useFrame runs once per animation frame, just before the renderer draws.
  // `delta` is seconds since the previous frame, and multiplying by it is what
  // makes speed frame-rate independent: a 120Hz display gets a delta half the
  // size, so the planet still turns the same amount per real-world second.
  // A hardcoded `+= 0.01` would spin twice as fast on that same display.
  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.4; // radians per second
  });

  return (
    // <mesh> is THREE.Mesh: a geometry (the shape) plus a material (how the
    // surface responds to light). Neither renders anything on its own.
    <mesh ref={meshRef}>
      {/* An icosahedron at detail level 1 is a faceted 80-face ball rather
          than a smooth sphere. Paired with flatShading below, this is the
          entire low-poly look — no textures to download. */}
      <icosahedronGeometry args={[1.4, 1]} />
      <meshStandardMaterial color="#22d3ee" flatShading />
    </mesh>
  );
}

export default function SolarSystem() {
  return (
    <Canvas
      // alpha keeps the canvas transparent so the existing CSS Cosmos3D
      // starfield shows through instead of a flat black rectangle.
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1.5, 5], fov: 50 }}
      // Cap pixel ratio at 2. A phone's native 3x renders 9x the pixels of 1x
      // for no perceptible gain, and it's the cheapest perf lever available.
      dpr={[1, 2]}
    >
      {/* The whole lighting model, in two lines. ambientLight adds a flat
          baseline to every surface so nothing is pure black; directionalLight
          is a parallel sun-like beam that creates the lit and shadowed sides.
          Comment both out and the planet disappears into the background —
          a standard material only shows the light that reaches it. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 3, 5]} intensity={2.2} />

      <SpinningPlanet />
    </Canvas>
  );
}
