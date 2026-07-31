"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  type BufferAttribute,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
} from "three";
import type { Planet } from "@/lib/planets";
import { hashId, mulberry32, type surfacePalette } from "@/lib/surface";
import { weatherColor, weatherProfile } from "@/lib/world";
import { useSystemStore } from "@/lib/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Palette = ReturnType<typeof surfacePalette>;

/**
 * The box the weather occupies, as a half-extent. Particles wrap inside it.
 *
 * A fixed box around the landing site rather than something that follows the
 * viewer, and that is only correct because of a decision made in sprint 5:
 * `SurfaceControls` pins the camera's *position* and lets you change only its
 * orientation. You can look anywhere and you never move, so the weather never
 * has to chase you. In a scene where you could walk, this would have to be a
 * volume centred on the camera, wrapping in the camera's own frame.
 */
const VOLUME = { xz: 34, y: 22 };

/** Seconds between lightning flashes, drawn uniformly from this range. */
const STRIKE_INTERVAL = [5, 14] as const;
/** How long one flash takes to decay. */
const STRIKE_DECAY = 0.55;

/**
 * Everything the air is doing: particles, sky bands, and lightning.
 *
 * Note what this component does **not** do: touch the sky colour or the
 * hemisphere light. Both belong to `SurfaceScene`, which rewrites them every
 * frame to drive the ascent fade. Lightning instead publishes an intensity
 * through `flashRef` and `SurfaceScene` applies it.
 *
 * That is not fastidiousness. R3F runs `useFrame` callbacks in subscription
 * order, and children subscribe before parents — so anything written to the sky
 * here would be overwritten by the parent later in the same frame and the flash
 * would simply never appear. It is the same one-owner-per-property rule the
 * phase machine applies to the camera, and it fails the same silent way.
 */
export default function Weather({
  planet,
  palette,
  flashRef,
}: {
  planet: Planet;
  palette: Palette;
  /** Lightning writes 0–1 here; SurfaceScene turns it into light. */
  flashRef: RefObject<number>;
}) {
  const profile = useMemo(() => weatherProfile(planet), [planet]);

  return (
    <>
      {profile.count > 0 && <Particles planet={planet} palette={palette} />}
      {profile.bands > 0 && <SkyBands planet={planet} palette={palette} />}
      {profile.lightning && <Lightning flashRef={flashRef} />}
    </>
  );
}

function Particles({ planet, palette }: { planet: Planet; palette: Palette }) {
  const profile = useMemo(() => weatherProfile(planet), [planet]);
  const color = useMemo(
    () => weatherColor(planet, palette.sky, palette.ground),
    [planet, palette.sky, palette.ground]
  );

  // Seeded like everything else on a world, so a reload gives the same starting
  // scatter. It stops mattering within a second of motion, but a world that is
  // deterministic should be deterministic all the way down.
  const positions = useMemo(() => {
    const random = mulberry32(hashId(`${planet.id}:weather`));
    const array = new Float32Array(profile.count * 3);
    for (let i = 0; i < profile.count; i++) {
      array[i * 3] = (random() - 0.5) * 2 * VOLUME.xz;
      array[i * 3 + 1] = random() * VOLUME.y;
      array[i * 3 + 2] = (random() - 0.5) * 2 * VOLUME.xz;
    }
    return array;
  }, [planet.id, profile.count]);

  const pointsRef = useRef<Points>(null);
  const clock = useRef(0);
  const phase = useSystemStore((s) => s.phase);
  const reduced = useReducedMotion();

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    // Reduced motion freezes the particles where they are rather than removing
    // them. The air still looks full of dust; it just is not moving. Removing
    // them would change what the world *is*, which is not what the preference
    // asks for.
    if (reduced) return;

    clock.current += delta;

    const attribute = points.geometry.getAttribute(
      "position"
    ) as BufferAttribute;
    const array = attribute.array as Float32Array;
    const [dx, dy, dz] = profile.drift;

    for (let i = 0; i < profile.count; i++) {
      const i3 = i * 3;
      // Offset by index so they do not all wander in lockstep — a field of snow
      // moving as one sheet is the giveaway that it is a particle system rather
      // than weather.
      const sway = profile.sway
        ? Math.sin(clock.current * 0.8 + i) * profile.sway * delta
        : 0;

      array[i3] += (dx + sway) * delta;
      array[i3 + 1] += dy * delta;
      array[i3 + 2] += dz * delta;

      // Wrap rather than respawn. Wrapping keeps the count and the distribution
      // exactly constant forever; respawning at a plane slowly biases the field
      // toward wherever that plane is.
      if (array[i3] > VOLUME.xz) array[i3] -= VOLUME.xz * 2;
      else if (array[i3] < -VOLUME.xz) array[i3] += VOLUME.xz * 2;
      if (array[i3 + 2] > VOLUME.xz) array[i3 + 2] -= VOLUME.xz * 2;
      else if (array[i3 + 2] < -VOLUME.xz) array[i3 + 2] += VOLUME.xz * 2;
      if (array[i3 + 1] < 0) array[i3 + 1] += VOLUME.y;
      else if (array[i3 + 1] > VOLUME.y) array[i3 + 1] -= VOLUME.y;
    }

    attribute.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      // Same reason the starfield and the rocks opt out: hit-testing walks every
      // raycastable object on every pointer move, and there are well over a
      // thousand of these.
      raycast={() => null}
      // One object at the origin whose contents move every frame, so a bounding
      // sphere computed once stops being true immediately. It is always around
      // you in any case, so culling could only ever be wrong here.
      frustumCulled={false}
      // Hidden rather than unmounted through the launch, so the buffer is not
      // rebuilt on the way back down.
      visible={phase === "surface" || phase === "departing"}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={profile.count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={profile.size}
        // Perspective sizing: near particles read bigger, which is most of what
        // gives a flat particle field any sense of depth.
        sizeAttenuation
        color={color}
        transparent
        opacity={profile.opacity}
        depthWrite={false}
        fog
      />
    </points>
  );
}

/**
 * Slow bands drifting across the sky.
 *
 * The sky is otherwise one flat colour — `<color attach="background">` — which
 * is fine while you are looking at the ground and obviously dead the moment you
 * look up. An inward-facing cylinder rather than a shader on the background, so
 * it sits *inside* the fog and composites with it for free.
 */
function SkyBands({ planet, palette }: { planet: Planet; palette: Palette }) {
  const profile = useMemo(() => weatherProfile(planet), [planet]);
  const meshRef = useRef<Mesh>(null);
  const reduced = useReducedMotion();

  const color = useMemo(
    () => new Color(palette.sky).offsetHSL(0, 0.04, -0.12),
    [palette.sky]
  );

  useFrame((_state, delta) => {
    if (reduced) return;
    const mesh = meshRef.current;
    if (mesh) mesh.rotation.y += delta * 0.012;
  });

  return (
    <mesh ref={meshRef} raycast={() => null} position-y={26}>
      {/* Open-ended: no caps, so there is nothing directly overhead to read as
          a ceiling. Wide and shallow, sitting above the horizon. */}
      <cylinderGeometry args={[210, 210, 70, 24, 1, true]} />
      <meshBasicMaterial
        color={color}
        side={BackSide}
        transparent
        opacity={profile.bands * 0.28}
        depthWrite={false}
        fog
      />
    </mesh>
  );
}

/**
 * Storm lightning.
 *
 * Publishes an intensity rather than lighting the scene itself — see the note
 * on the default export.
 *
 * Off entirely under reduced motion. A full-screen brightness strobe is the
 * single most likely thing in this codebase to do somebody actual harm, and
 * photosensitivity is a large part of why that preference exists. Not dimmed,
 * not slowed — off.
 */
function Lightning({ flashRef }: { flashRef: RefObject<number> }) {
  const reduced = useReducedMotion();
  const phase = useSystemStore((s) => s.phase);

  const strength = useRef(0);
  const timer = useRef(0);
  const nextStrike = useRef(
    STRIKE_INTERVAL[0] +
      Math.random() * (STRIKE_INTERVAL[1] - STRIKE_INTERVAL[0])
  );
  const materialRef = useRef<MeshBasicMaterial>(null);

  useFrame((_state, delta) => {
    // Stand down for anything that is not standing still on the ground. During
    // a departure SurfaceScene is driving the sky toward space, and a flash
    // would be fighting it over the one scripted move meant to be watched.
    if (reduced || phase !== "surface") {
      strength.current = 0;
      flashRef.current = 0;
      if (materialRef.current) materialRef.current.opacity = 0;
      return;
    }

    timer.current += delta;
    if (timer.current >= nextStrike.current) {
      timer.current = 0;
      nextStrike.current =
        STRIKE_INTERVAL[0] +
        Math.random() * (STRIKE_INTERVAL[1] - STRIKE_INTERVAL[0]);
      strength.current = 1;
    } else if (strength.current > 0) {
      // `else if`, not `if`, and it matters. Decaying on the same frame the
      // strike fires means the flash is reduced before it has ever been drawn —
      // imperceptible at 60fps, and total on a slow device or the first frame
      // after a stall, where one delta can exceed the whole decay and the strike
      // is consumed without appearing. Guaranteeing one frame at full strength
      // makes the flash independent of frame rate.
      strength.current = Math.max(0, strength.current - delta / STRIKE_DECAY);
    }

    // Squared so the flash spikes and falls away rather than fading linearly,
    // which reads as a dimmer being turned down.
    const intensity = strength.current * strength.current;
    flashRef.current = intensity;
    if (materialRef.current) materialRef.current.opacity = intensity * 0.35;
  });

  return (
    // A sheet high overhead that brightens with the flash, so a strike reads as
    // coming from somewhere rather than as the whole world changing exposure.
    // Additive, so it can only ever add light.
    <mesh raycast={() => null} position-y={48} rotation-x={Math.PI / 2}>
      <circleGeometry args={[160, 16]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
        fog={false}
      />
    </mesh>
  );
}
