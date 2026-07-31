"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import type { Planet } from "@/lib/planets";
import type { surfacePalette } from "@/lib/surface";
import { skylineLayout, type Building } from "@/lib/world";

type Palette = ReturnType<typeof surfacePalette>;

/**
 * Somebody lives here.
 *
 * A ring of buildings standing far enough out that the fog resolves them as
 * pale shapes rather than as models — which is the whole reason this can be
 * boxes and hexagonal prisms and still read as a city. How far that is depends
 * on the world's own weather and is solved in lib/world.ts, not picked here.
 *
 * It never competes with the content. The props stand inside 15 units, so the
 * settlement is unambiguously *scenery*: it says the world is inhabited and
 * then gets out of the way of the thing you actually came to read.
 *
 * Two instanced meshes, not fifty-eight objects. Fifty-eight meshes is
 * fifty-eight draw calls and fifty-eight matrix updates for something nobody
 * looks at directly; instancing makes it two of each. Both opt out of
 * raycasting like the rocks and the orbit rings — hit-testing walks every
 * raycastable object on every pointer move, and a wall of buildings across the
 * horizon is exactly the sort of thing that would start eating clicks meant for
 * a monolith in front of it.
 */
export default function Skyline({
  planet,
  palette,
}: {
  planet: Planet;
  palette: Palette;
}) {
  const buildings = useMemo(() => skylineLayout(planet), [planet]);

  const boxes = useMemo(() => buildings.filter((b) => !b.round), [buildings]);
  const rounds = useMemo(() => buildings.filter((b) => b.round), [buildings]);

  /**
   * Darker than the ground, and deliberately not the prop colour.
   *
   * The props were lifted *above* the ground to make them findable; the skyline
   * is pushed below it for the opposite reason. Fog lightens everything at this
   * distance toward the sky colour, so starting dark is what leaves any
   * silhouette at all — start at ground colour and the buildings dissolve into
   * the horizon completely.
   */
  const color = useMemo(
    () => new Color(palette.ground).offsetHSL(0, -0.05, -0.16),
    [palette.ground]
  );

  if (buildings.length === 0) return null;

  return (
    <>
      {boxes.length > 0 && (
        <BuildingCluster buildings={boxes} color={color} round={false} />
      )}
      {rounds.length > 0 && (
        <BuildingCluster buildings={rounds} color={color} round />
      )}
    </>
  );
}

function BuildingCluster({
  buildings,
  color,
  round,
}: {
  buildings: Building[];
  color: Color;
  round: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);

  // A layout effect rather than a frame callback: these never move, so the
  // matrices are written once on mount and never touched again. Writing them
  // in useFrame would be the obvious mistake — 58 matrix composes a frame for
  // geometry that is, by construction, completely static.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new Object3D();
    buildings.forEach((building, i) => {
      dummy.position.set(
        building.position[0],
        // Geometry is centred on its own origin, so half the height lifts the
        // base to the ground plane — same reasoning as the content props.
        building.height / 2,
        building.position[2]
      );
      dummy.rotation.set(0, building.rotationY, 0);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Without this the whole cluster is culled the moment its *origin* leaves
    // the frustum, which for a ring centred on the landing site means the
    // entire skyline vanishing as you turn your head. An instanced mesh's
    // bounding sphere is computed from the base geometry, not the instances.
    mesh.computeBoundingSphere();
  }, [buildings]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, buildings.length]}
      raycast={() => null}
    >
      {round ? (
        // Six sides, not smooth. At this distance the silhouette is all that
        // survives the fog, and a hexagonal prism reads as a dome-ish mass for
        // a twelfth of the triangles.
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      {/*
        Unlit on purpose. These sit far enough out that the directional light
        contributes almost nothing before fog takes over, and a lit material
        would spend a per-pixel lighting calculation to arrive at the same pale
        haze. Flat colour plus fog is the entire look.
      */}
      <meshBasicMaterial color={color} fog />
    </instancedMesh>
  );
}
