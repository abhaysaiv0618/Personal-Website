"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  Color,
  MathUtils,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import type { Planet, PropKind } from "@/lib/planets";
import { PROP_DIMENSIONS, type PlacedProp, propLayout } from "@/lib/props";
import type { surfacePalette } from "@/lib/surface";
import { isBusy, useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Palette = ReturnType<typeof surfacePalette>;

/**
 * How far a pointer may travel between press and release and still count as a
 * click on an object.
 *
 * This is not belt and braces — without it the surface is unusable. R3F applies
 * its own 2px threshold to `onPointerMissed` only; object `onClick` handlers
 * are handed the distance as `event.delta` and are expected to decide for
 * themselves (see handlePointer in @react-three/fiber's events module). Since
 * SurfaceControls captures the pointer to let you drag-look, *every* look
 * around that happens to finish with the cursor over a monolith would otherwise
 * open its panel.
 */
const CLICK_SLOP = 3;

/** Self-illumination at rest and while hovered. Mirrors Planet.tsx. */
const EMISSIVE_REST = 0.12;
const EMISSIVE_HOVER = 0.62;
/** Extra size while hovered. Smaller than a planet's — these are close up. */
const HOVER_SCALE = 1.06;

/**
 * The content, standing on the ground.
 *
 * Everything about these is derived (lib/props.ts): the kind from the planet's
 * one authored field, the count from the section's content, the arrangement
 * from a hash of the id. Nothing in this file knows there are five projects or
 * four jobs.
 *
 * Two decisions worth stating, because both look like oversights:
 *
 *  - **Labels are always on**, not revealed on hover. There are at most five
 *    per world, they are the entire reason the world exists, and a visitor who
 *    has to sweep a mouse across an alien plain to discover that the slabs are
 *    clickable has been given a puzzle instead of a portfolio.
 *  - **Nothing bobs or spins** except the beacon's lamp. Idle motion on a solid
 *    object resting on the ground reads as a physics bug, not as life.
 */
export default function SurfaceProps({
  planet,
  palette,
}: {
  planet: Planet;
  palette: Palette;
}) {
  const placed = useMemo(() => propLayout(planet), [planet]);

  if (placed.length === 0) return null;

  return (
    <>
      {placed.map((prop) => (
        <SurfaceProp
          key={prop.id}
          prop={prop}
          kind={planet.propKind}
          accent={planet.accent}
          palette={palette}
        />
      ))}
    </>
  );
}

function SurfaceProp({
  prop,
  kind,
  accent,
  palette,
}: {
  prop: PlacedProp;
  kind: PropKind;
  accent: string;
  palette: Palette;
}) {
  const dims = PROP_DIMENSIONS[kind];

  const bodyRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const lampRef = useRef<MeshStandardMaterial>(null);
  // Hover is per-object and nothing outside this component cares, so it lives
  // on a ref and is eased on the material. Putting it in React state would
  // re-render a subtree on every pointer move across a plain full of objects.
  const hovered = useRef(false);
  const clock = useRef(0);

  const phase = useSystemStore((s) => s.phase);
  const activePropId = useSystemStore((s) => s.activePropId);
  const openProp = useSystemStore((s) => s.openProp);
  const reduced = useReducedMotion();
  const gl = useThree((s) => s.gl);

  const isOpen = activePropId === prop.id;

  // Allocated once and mutated in place — the glow lerps toward one of these
  // every frame, and building Colors per frame feeds the garbage collector.
  const restColor = useMemo(() => palette.rock.clone(), [palette.rock]);
  const activeColor = useMemo(() => new Color(accent), [accent]);

  useFrame((_state, delta) => {
    clock.current += delta;

    // The open panel keeps its object lit, so there is always something on
    // screen tying the sheet of text to the thing in the world it came from.
    const lit = hovered.current || isOpen;

    const material = materialRef.current;
    if (material) {
      // Eased on the material rather than switched through a React prop — the
      // same rule that stopped planets flicking brighter the frame a flight
      // arrived. A brightness step is the change the eye is most sensitive to.
      const k = 1 - Math.pow(0.02, delta);
      material.emissiveIntensity = MathUtils.lerp(
        material.emissiveIntensity,
        lit ? EMISSIVE_HOVER : EMISSIVE_REST,
        k
      );
      material.emissive.lerp(lit ? activeColor : restColor, k);
    }

    const body = bodyRef.current;
    if (body) {
      const target = lit ? HOVER_SCALE : 1;
      const k = 1 - Math.pow(0.002, delta);
      body.scale.lerp({ x: target, y: target, z: target }, k);
    }

    // The one thing that moves on its own. A lamp that pulses reads as powered;
    // a slab that bobs reads as broken. Frozen at mid-brightness under reduced
    // motion rather than removed — it still has to look switched on.
    const lamp = lampRef.current;
    if (lamp) {
      lamp.emissiveIntensity = reduced
        ? 1.5
        : 1.5 + Math.sin(clock.current * 1.8) * 0.6;
    }
  });

  const setCursor = (value: string) => {
    // The canvas carries its own inline cursor (SurfaceControls sets `grab`),
    // and an inline style on the element beats anything set on document.body —
    // so this has to be written to the same element to have any effect.
    gl.domElement.style.cursor = value;
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // See CLICK_SLOP. A drag that ends here is a look-around, not a click.
    if (e.delta > CLICK_SLOP) return;
    openProp(prop.id);
  };

  return (
    <group position={prop.position} rotation-y={prop.rotationY}>
      {/* A pad under each object. Cheap, and it does the same job the rocks'
          partial burial does — something resting exactly on an unbroken plane
          reads as placed there by a level editor. */}
      <mesh position-y={0.02} rotation-x={-Math.PI / 2} raycast={() => null}>
        <circleGeometry args={[Math.max(dims.width, dims.depth) * 0.9, 24]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>

      <mesh
        ref={bodyRef}
        // Geometry is built centred on the origin, so lifting by half the
        // height stands it *on* the ground rather than half-buried in it. The
        // rocks want the opposite and get it for the opposite reason.
        position-y={dims.height / 2}
        onPointerOver={(e) => {
          e.stopPropagation();
          hovered.current = true;
          setCursor("pointer");
        }}
        onPointerOut={() => {
          hovered.current = false;
          setCursor("grab");
        }}
        onClick={handleClick}
      >
        <PropGeometry kind={kind} />
        <meshStandardMaterial
          ref={materialRef}
          color={palette.rock}
          flatShading
          roughness={0.72}
          metalness={0.15}
          emissive={palette.rock}
          emissiveIntensity={EMISSIVE_REST}
        />
      </mesh>

      {/* The beacon's lamp. Its own material with its own constant-ish
          brightness, rather than a second thing eased in lockstep with the
          body — the same call the planet rings make. */}
      {kind === "beacon" && (
        <mesh position-y={dims.height + 0.18} raycast={() => null}>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial
            ref={lampRef}
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Hidden while a scripted move is running, for the reason the planet
          labels are: <Html> is real DOM and appears in a single frame however
          the rest is eased, so labels left up would pop over the launch. */}
      {!isBusy(phase) && (
        <Html
          center
          position={[0, dims.height + (kind === "beacon" ? 0.9 : 0.55), 0]}
          // Must never swallow the click meant for the object underneath it.
          pointerEvents="none"
          zIndexRange={[20, 0]}
        >
          <span
            className="pointer-events-none flex max-w-[13rem] select-none flex-col items-center gap-0.5 whitespace-normal rounded-xl border px-2.5 py-1 text-center backdrop-blur-sm"
            style={{
              color: accent,
              borderColor: `${accent}55`,
              backgroundColor: "rgba(5,5,5,0.66)",
            }}
          >
            <span className="text-[0.7rem] font-medium leading-tight sm:text-xs">
              {prop.title}
            </span>
            {prop.subtitle && (
              <span className="text-[0.55rem] uppercase tracking-[0.16em] opacity-60 sm:text-[0.6rem]">
                {prop.subtitle}
              </span>
            )}
          </span>
        </Html>
      )}
    </group>
  );
}

/**
 * The five shapes, all built from the same faceted primitives as the planets
 * and the rocks. Keeping one visual language across three scenes that share no
 * geometry is most of what makes the surface read as the same world you were
 * looking at from orbit.
 */
function PropGeometry({ kind }: { kind: PropKind }) {
  const { width, height, depth } = PROP_DIMENSIONS[kind];

  switch (kind) {
    case "monolith":
      return <boxGeometry args={[width, height, depth]} />;

    case "crate":
      return <boxGeometry args={[width, height, depth]} />;

    // A four-sided taper, so it reads as carved rather than extruded. Radii are
    // half-widths, and the corners of a 4-segment cylinder sit on the radius —
    // so the flat faces come in slightly narrower than `width`, which is fine.
    case "monument":
      return <cylinderGeometry args={[width * 0.18, width * 0.5, height, 4]} />;

    // A console: wider than it is deep, with the top bevelled away from you.
    case "terminal":
      return <cylinderGeometry args={[width * 0.34, width * 0.5, height, 6]} />;

    case "beacon":
      return <cylinderGeometry args={[width * 0.4, width * 0.5, height, 6]} />;
  }
}
