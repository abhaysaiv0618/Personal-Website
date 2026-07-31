"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  MathUtils,
  type FogExp2,
  type Group,
  type HemisphereLight,
} from "three";
import type { Planet } from "@/lib/planets";
import { ASCENT } from "@/lib/cut";
import { useSystemStore } from "@/lib/store";
import {
  EYE_HEIGHT,
  FOG_DENSITY,
  GROUND_RADIUS,
  ROCKET_SCALE,
  SPACE_COLOR,
  SURFACE_ORIGIN,
  rockLayout,
  rocketAscent,
  rocketPlacement,
  surfacePalette,
} from "@/lib/surface";
import Rocket from "@/components/system/Rocket";
import SurfaceProps from "./SurfaceProps";

/** Sky and fog hold until the rocket is clear of the pad, then thin out. */
const ATMOSPHERE_FADE = { start: 0.15, end: 0.85 };
/** Fog never reaches zero — see the note where it's applied. */
const FOG_FLOOR = 0.15;
/** Ambient brightness at altitude, as a fraction of ground level. */
const LIGHT_FLOOR = 0.25;

/**
 * The world you land on.
 *
 * It is not the planet. It is a flat disc a thousand units below the solar
 * system, and the icosahedron you were looking at from orbit is still up there
 * untouched. Landing on the real body would mean surface-relative camera work
 * on a sphere roughly the size of the rocket — curvature, up-vectors, scale
 * mismatch — for an effect nobody can distinguish from this one.
 *
 * What sells it instead is three cheap tricks doing the work of geometry:
 *
 *  - **Fog**, which hides the disc's edge and does all the depth cueing on a
 *    plane that has no other depth information in it.
 *  - **A tinted hemisphere light**, which pours sky colour onto every
 *    up-facing surface. This is most of what makes a place read as alien; a
 *    grey rock under a coloured sky still looks like a grey rock on Earth.
 *  - **A palette pulled from the planet itself**, so the ground is recognisably
 *    the colour of the body you were just orbiting. The two scenes share no
 *    geometry whatsoever, and colour continuity is the only thread connecting
 *    them.
 *
 * Everything here is derived from the planet's id and its two colours — see
 * lib/surface.ts. Adding a section stays a one-line change.
 */
export default function SurfaceScene({ planet }: { planet: Planet }) {
  // Both are pure functions of the planet, so they're recomputed only when you
  // land somewhere new — never per frame, and never per render.
  const palette = useMemo(() => surfacePalette(planet), [planet]);
  const rocks = useMemo(() => rockLayout(planet), [planet]);

  // The rocket's offset depends on how wide the frame actually is, so it is
  // re-solved on resize rather than baked at module load. Reading `size`
  // rather than `viewport` because this is about the canvas's pixel aspect,
  // not the world units visible at some depth.
  const size = useThree((s) => s.size);
  const rocketOffset = useMemo(
    () => rocketPlacement(size.width / Math.max(size.height, 1)),
    [size.width, size.height]
  );

  const phase = useSystemStore((s) => s.phase);
  const launching = phase === "departing";

  const rocketRef = useRef<Group>(null);
  const skyRef = useRef<Color>(null);
  const fogRef = useRef<FogExp2>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const elapsed = useRef(0);
  const spaceColor = useMemo(() => new Color(SPACE_COLOR), []);

  useFrame((_state, delta) => {
    const rocket = rocketRef.current;
    const sky = skyRef.current;
    const fog = fogRef.current;
    const hemi = hemiRef.current;

    if (!launching) {
      // Parked. Everything is written back explicitly rather than left alone:
      // the sky Color and the fog are attached to the shared scene and were
      // mutated in place during the last launch, so landing here again would
      // otherwise open on the blackened sky the previous departure left behind.
      elapsed.current = 0;
      if (rocket) rocket.position.y = rocketOffset[1];
      if (sky) sky.copy(palette.sky);
      if (fog) fog.density = FOG_DENSITY;
      if (hemi) hemi.intensity = 1.15;
      return;
    }

    elapsed.current += delta;
    const progress = Math.min(elapsed.current / (ASCENT.MOVE_MS / 1000), 1);

    // The same pure function Descent uses to place the chase camera, so the
    // two cannot drift apart.
    if (rocket) rocket.position.y = rocketOffset[1] + rocketAscent(progress);

    // Climb out of the atmosphere. This is what makes the cut work: the veil
    // that follows is black, and closing black over an already-black sky is
    // nearly invisible. Fading up through the planet's colour instead — which
    // is what this used to do — flashed the screen bright at the exact moment
    // you were supposedly leaving for space.
    const out = MathUtils.clamp(
      (progress - ATMOSPHERE_FADE.start) /
        (ATMOSPHERE_FADE.end - ATMOSPHERE_FADE.start),
      0,
      1
    );

    if (sky) sky.copy(palette.sky).lerp(spaceColor, out);
    // Thinned rather than removed. At zero fog the ground disc's rim becomes
    // visible from altitude, and a world with a visible edge is worse than a
    // hazy one.
    if (fog) fog.density = FOG_DENSITY * MathUtils.lerp(1, FOG_FLOOR, out);
    // The ground has to darken with the sky. Left at full intensity it stays
    // brightly lit under a black sky, which reads as a lighting bug rather
    // than as altitude.
    if (hemi) hemi.intensity = 1.15 * MathUtils.lerp(1, LIGHT_FLOOR, out);
  });

  return (
    <>
      {/*
        Sky and fog, and they must be siblings of the group rather than
        children of it. `attach` binds to the *direct parent*, and the parent
        is the scene only because these sit at the top level of this component
        — SurfaceScene is rendered straight into <Canvas>. Nested one level
        deeper, inside the group, they attached to a Group instead. A Group has
        no `background` and no `fog`, so both assignments silently did nothing:
        no sky colour at all, no fog, the CSS starfield showing straight through
        the "atmosphere", and a hard rim where the ground disc ended. Two of the
        three tricks that make this read as a place were inert.

        Nothing errors when you get this wrong. The Group accepts the property
        without complaint and three.js simply never reads it.

        Mounting them in this component rather than in a phase conditional
        higher up is still what makes cleanup free: R3F's `attach` records the
        previous value and restores it on unmount, so leaving a surface puts
        `scene.background` back to null on its own and the canvas goes
        transparent again behind the solar system.
      */}
      <color ref={skyRef} attach="background" args={[palette.sky]} />
      <fogExp2 ref={fogRef} attach="fog" args={[palette.sky, FOG_DENSITY]} />

      <group position={SURFACE_ORIGIN}>
        {/*
          Sky above, ground below. One light doing the job of a whole environment
          map: it's the difference between "a plane with objects on it" and "a
          place with air in it".
        */}
        <hemisphereLight ref={hemiRef} args={[palette.sky, palette.ground, 1.15]} />

        {/*
          A low sun for direction. Without a directional source every face of a
          flat-shaded rock takes the same hemisphere tint and the low-poly
          silhouettes disappear. No shadow map — shadows are a sprint 7 decision
          with a real frame-time cost, and fog is already selling the depth.
        */}
        <directionalLight
          position={[40, 22, -30]}
          intensity={1.3}
          color={palette.sunlight}
        />

        {/* The ground. A disc rather than a plane so there are no corners to
            catch the eye at the horizon, and it never needs to be square with
            whichever way you happen to be facing. */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow={false}>
          <circleGeometry args={[GROUND_RADIUS, 96]} />
          <meshStandardMaterial color={palette.ground} roughness={0.95} />
        </mesh>

        {/* Terrain. Same faceted icosahedra as the planets, which is what keeps
            one visual language across two scenes built from nothing in common. */}
        {rocks.map((rock, i) => (
          <mesh
            key={i}
            position={rock.position}
            rotation={rock.rotation}
            // Rocks are scenery, and hit-testing walks every raycastable object
            // on every pointer move. Sprint 6's props opt *in*; nothing else
            // should be paying for them.
            raycast={() => null}
          >
            <icosahedronGeometry args={[rock.radius, rock.detail]} />
            <meshStandardMaterial color={palette.rock} flatShading roughness={0.9} />
          </mesh>
        ))}

        {/* What you came here to read, standing on the ground. The only
            raycastable things on the surface — the rocks opted out above and the
            ground has no handlers at all, which is what makes a click on bare
            ground register as a miss and dismiss the panel. */}
        <SurfaceProps planet={planet} palette={palette} />

        {/* The rocket you flew in — parked and shut down, until you leave.
            Its first appearance in the whole experience: the flight is first
            person, so until now the camera *was* the rocket and there was
            nothing to look at.

            On departure it lights and climbs, and the camera goes up after it
            (Descent). That is a deliberate break from first person: the one
            moment worth seeing your ship from outside is the moment it leaves. */}
        <group
          ref={rocketRef}
          position={rocketOffset}
          scale={ROCKET_SCALE}
          // Turned a few degrees off the view axis so it reads as parked rather
          // than presented.
          rotation-y={0.6}
        >
          <Rocket engine={launching} color="#e2e8f0" />
        </group>

        {/* A soft glow at the landing site, standing in for the light the engine
            would be throwing if it were still lit. Keeps the immediate ground
            around your feet from falling into flat hemisphere tint. */}
        <pointLight
          position={[0, EYE_HEIGHT, 0]}
          intensity={6}
          distance={26}
          color={palette.sky}
        />
      </group>
    </>
  );
}
