"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { Planet } from "@/lib/planets";
import {
  EYE_HEIGHT,
  FOG_DENSITY,
  GROUND_RADIUS,
  ROCKET_SCALE,
  SURFACE_ORIGIN,
  rockLayout,
  rocketPlacement,
  surfacePalette,
} from "@/lib/surface";
import Rocket from "@/components/system/Rocket";

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

  return (
    <group position={SURFACE_ORIGIN}>
      {/*
        Sky and fog are attached to the *scene*, which is shared with the solar
        system — so mounting them here would be a leak if they had to be undone
        by hand. They don't: R3F's `attach` records the previous value and puts
        it back on unmount. Leaving the surface therefore restores
        `scene.background` to null on its own, which is what lets the canvas go
        transparent again and the CSS starfield show through behind the system.
        Placing them inside this component rather than in a phase conditional
        higher up is what buys that.
      */}
      <color attach="background" args={[palette.sky]} />
      <fogExp2 attach="fog" args={[palette.sky, FOG_DENSITY]} />

      {/*
        Sky above, ground below. One light doing the job of a whole environment
        map: it's the difference between "a plane with objects on it" and "a
        place with air in it".
      */}
      <hemisphereLight args={[palette.sky, palette.ground, 1.15]} />

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

      {/* The rocket you flew in, parked and shut down. Its first appearance in
          the whole experience: the flight is first person, so until now the
          camera *was* the rocket and there was nothing to look at. */}
      <group
        position={rocketOffset}
        scale={ROCKET_SCALE}
        // Turned a few degrees off the view axis so it reads as parked rather
        // than presented.
        rotation-y={0.6}
      >
        <Rocket engine={false} color="#e2e8f0" />
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
  );
}
