"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  Color,
  DoubleSide,
  MathUtils,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import { PLANET_RING, type Planet as PlanetData } from "@/lib/planets";
import { registerPlanet, unregisterPlanet } from "@/lib/planetRegistry";
import { isBusy, isInSpace, useSystemStore } from "@/lib/store";

/** Extra size applied while hovered or focused. */
const HOVER_SCALE = 1.28;
/** Self-illumination at rest, and while hovered or focused. */
const EMISSIVE_REST = 0.18;
const EMISSIVE_ACTIVE = 0.55;

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
  const materialRef = useRef<MeshStandardMaterial>(null);

  // Allocated once and mutated in place. The glow eases toward one of these
  // every frame, so building them per frame would hand the garbage collector
  // two objects 60 times a second per planet.
  const restColor = useMemo(() => new Color(planet.color), [planet.color]);
  const activeColor = useMemo(() => new Color(planet.accent), [planet.accent]);

  const hoveredId = useSystemStore((s) => s.hoveredId);
  const focusedId = useSystemStore((s) => s.focusedId);
  const phase = useSystemStore((s) => s.phase);
  const hover = useSystemStore((s) => s.hover);
  const travelTo = useSystemStore((s) => s.travelTo);

  const isHovered = hoveredId === planet.id;
  const isFocused = focusedId === planet.id;
  const isActive = isHovered || isFocused;

  // Hiding the system (SolarSystem.tsx) does not hide this planet's label,
  // because <Html> is real DOM parented to the page rather than geometry the
  // renderer skips. And `focusedId` stays set for the planet you landed on, so
  // without this its label would hang in mid-air over the surface scene,
  // projected from a body a thousand units above your head.
  //
  // The same applies to hit-testing: three's raycaster ignores `visible`, so
  // these bodies are still pickable while you stand on one of them.
  const inSpace = isInSpace(phase);

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

    // The glow eases for exactly the same reason, and it did not used to.
    // Driving emissive through React props switched it in a single frame, so
    // the moment a flight arrived the planet visibly *flicked* brighter —
    // right between the approach and the dive, which made one continuous move
    // read as three separate events. Anything that changes as a result of a
    // discrete state flip still has to arrive continuously on screen.
    // Slower than the scale on purpose. A size change reads as responsive
    // when it snaps; a brightness change reads as a *flash*, and the eye is
    // far more sensitive to it. At the scale constant this took ~0.35s, which
    // still registered as the planet flicking on at the end of the approach.
    // ~0.8s makes it a swell that runs underneath the descent instead of an
    // event that punctuates it.
    const kGlow = 1 - Math.pow(0.06, delta);
    const material = materialRef.current;
    if (material) {
      material.emissiveIntensity = MathUtils.lerp(
        material.emissiveIntensity,
        isActive ? EMISSIVE_ACTIVE : EMISSIVE_REST,
        kGlow
      );
      material.emissive.lerp(isActive ? activeColor : restColor, kGlow);
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!inSpace) return;
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
          ref={materialRef}
          color={planet.color}
          flatShading
          // A little self-illumination keeps the night side from going fully
          // black once the only light source is the sun at the centre.
          //
          // These are only the *starting* values — the glow is animated on the
          // material inside useFrame, not re-rendered through here. Setting it
          // from `isActive` would step it in one frame.
          emissive={planet.color}
          emissiveIntensity={EMISSIVE_REST}
          roughness={0.85}
        />

        {/* Saturn. Tilted rather than laid flat, because a ring seen exactly
            edge-on from the system's default viewing angle would vanish — the
            tilt is what makes the silhouette read from anywhere.

            Nested inside the body mesh so it inherits the hover scale and the
            axial spin for free (a ring is rotationally symmetric, so spinning
            it costs nothing visually). Not raycastable, for the same reason
            the orbit rings aren't: it's a wide flat disc sitting in front of
            its own planet and would swallow the click meant for it. */}
        {planet.ring && (
          <group rotation-x={-Math.PI / 2 + 0.42} rotation-y={0.2}>
            <mesh raycast={() => null}>
              <ringGeometry
                args={[
                  planet.size * PLANET_RING.inner,
                  planet.size * PLANET_RING.outer,
                  72,
                ]}
              />
              <meshStandardMaterial
                color={planet.accent}
                side={DoubleSide}
                transparent
                opacity={0.72}
                roughness={0.9}
                emissive={planet.accent}
                // Constant rather than reacting to focus. The body's glow
                // already carries that signal, and easing a second material
                // in lockstep buys nothing except another thing that can step
                // in one frame.
                emissiveIntensity={0.16}
              />
            </mesh>
          </group>
        )}

        {/* Hidden while any scripted move is running. The label is DOM, so it
            appears and disappears in one frame no matter how the rest is
            eased — and it was popping in at exactly the moment a flight
            arrived, adding a third event to what should read as one move. It
            also meant the *previous* planet's label hung on screen for the
            whole flight, labelling somewhere you had already left. */}
        {isActive && inSpace && !isBusy(phase) && (
          // <Html> renders real DOM positioned in 3D space, so the label gets
          // crisp text and Tailwind styling instead of a rasterised texture.
          // Fine for six occasional labels; it would be the wrong tool for
          // hundreds, since each one is a live DOM node being repositioned.
          <Html
            center
            // Keep the label clear of the body at any planet size — and clear
            // of the rings, which reach well past the surface on the one
            // planet that has them.
            position={[
              0,
              planet.size *
                (planet.ring ? PLANET_RING.outer : 1) *
                HOVER_SCALE +
                0.5,
              0,
            ]}
            // The label must never swallow the click meant for the planet.
            pointerEvents="none"
            zIndexRange={[20, 0]}
          >
            <span
              className="pointer-events-none flex select-none flex-col items-center whitespace-nowrap rounded-2xl border px-3 py-1 backdrop-blur-sm"
              style={{
                color: planet.accent,
                borderColor: `${planet.accent}66`,
                backgroundColor: "rgba(5,5,5,0.72)",
              }}
            >
              <span className="text-xs font-medium tracking-wide sm:text-sm">
                {planet.label}
              </span>
              {/* The body it's dressed as, secondary to the section it
                  actually navigates to. The section is what the visitor is
                  choosing; the planet is the costume. */}
              <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-55 sm:text-[0.65rem]">
                {planet.body}
              </span>
            </span>
          </Html>
        )}
      </mesh>
    </group>
  );
}
