"use client";

import { useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group, Mesh } from "three";
import type { Planet as PlanetData } from "@/lib/planets";
import { registerPlanet, unregisterPlanet } from "@/lib/planetRegistry";
import { useSystemStore } from "@/lib/store";

/** Extra size applied while hovered or focused. */
const HOVER_SCALE = 1.28;

/**
 * One orbiting planet.
 *
 * The orbit is two nested transforms and no trigonometry:
 *
 *     <group rotation-y>          ← pivot at the sun (0,0,0)
 *       <mesh position-x={r}>     ← body, offset along the pivot's X axis
 *
 * Rotating the pivot sweeps the body around a circle of radius r, because a
 * child's position is expressed in its parent's coordinate space. Computing
 * x = cos(t)*r, z = sin(t)*r by hand gives the same picture but stops scaling
 * the moment anything nests deeper — a moon orbiting a planet orbiting a sun
 * is one more group here, and a matrix headache by hand.
 */
export default function Planet({ planet }: { planet: PlanetData }) {
  const pivotRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);

  const hoveredId = useSystemStore((s) => s.hoveredId);
  const focusedId = useSystemStore((s) => s.focusedId);
  const phase = useSystemStore((s) => s.phase);
  const hover = useSystemStore((s) => s.hover);
  const travelTo = useSystemStore((s) => s.travelTo);

  const isHovered = hoveredId === planet.id;
  const isFocused = focusedId === planet.id;
  const isActive = isHovered || isFocused;

  // Publish this body so CameraRig can read its live world position each
  // frame. It orbits, so its position can't be derived from lib/planets.ts —
  // only the object itself knows where it currently is.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    registerPlanet(planet.id, body);
    return () => unregisterPlanet(planet.id);
  }, [planet.id]);

  // Reset the cursor if this planet unmounts while hovered, otherwise the
  // pointer would stay stuck as a hand.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((_state, delta) => {
    // Orbit: rotate the pivot and the body rides along.
    //
    // Frozen during a flight. The rocket's arc is computed once at launch
    // against the destination's position at that instant, so if the planet
    // kept orbiting the curve would be aimed where it *used* to be and the
    // rocket would arrive at empty space. Freezing makes the destination
    // stable for the duration, and the brief time-stop reads as cinematic.
    //
    // Axial spin below is deliberately left running: it doesn't move the
    // planet, so it costs nothing to keep, and a fully frozen system looks
    // broken rather than paused.
    if (pivotRef.current && phase !== "traveling") {
      pivotRef.current.rotation.y += delta * planet.orbitSpeed;
    }

    const body = bodyRef.current;
    if (!body) return;

    // Axial spin, independent of the orbit happening above it in the tree.
    body.rotation.y += delta * 0.25;

    // Hover scale is *continuous* state, so it eases on the object directly
    // rather than through React. The hovered id in the store is discrete and
    // re-renders; the animation toward it never does.
    const targetScale = isActive ? HOVER_SCALE : 1;
    const k = 1 - Math.pow(0.002, delta);
    body.scale.lerp({ x: targetScale, y: targetScale, z: targetScale }, k);
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    // Without stopPropagation the ray continues through and any object behind
    // this one also reports a hover.
    e.stopPropagation();
    hover(planet.id);
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    hover(null);
    document.body.style.cursor = "auto";
  };

  return (
    <group ref={pivotRef} rotation-y={planet.startAngle}>
      <mesh
        ref={bodyRef}
        position-x={planet.orbitRadius}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={(e) => {
          e.stopPropagation();
          travelTo(planet.id);
        }}
      >
        <icosahedronGeometry args={[planet.size, 1]} />
        <meshStandardMaterial
          color={planet.color}
          flatShading
          // A little self-illumination keeps the night side from going fully
          // black once the only light source is the sun at the centre.
          emissive={isActive ? planet.accent : planet.color}
          emissiveIntensity={isActive ? 0.55 : 0.18}
          roughness={0.85}
        />

        {isActive && (
          // <Html> renders real DOM positioned in 3D space, so the label gets
          // crisp text and Tailwind styling instead of a rasterised texture.
          // Fine for six occasional labels; it would be the wrong tool for
          // hundreds, since each one is a live DOM node being repositioned.
          <Html
            center
            // Keep the label clear of the body at any planet size.
            position={[0, planet.size * HOVER_SCALE + 0.5, 0]}
            // The label must never swallow the click meant for the planet.
            pointerEvents="none"
            zIndexRange={[20, 0]}
          >
            <span
              className="pointer-events-none select-none whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium tracking-wide backdrop-blur-sm sm:text-sm"
              style={{
                color: planet.accent,
                borderColor: `${planet.accent}66`,
                backgroundColor: "rgba(5,5,5,0.72)",
              }}
            >
              {planet.label}
            </span>
          </Html>
        )}
      </mesh>
    </group>
  );
}
