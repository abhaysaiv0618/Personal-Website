import { MathUtils, PerspectiveCamera, Vector3 } from "three";

/** Shared so the Canvas and the fit solver can't disagree about the lens. */
export const CAMERA_FOV = 50;

/**
 * Viewing angle for the whole-system shot, adapted to window shape.
 *
 * The system is a flat disc, so its on-screen width is always ~2R regardless
 * of angle, while its height is 2R·sin(elevation). On a narrow portrait
 * window the fit distance is therefore forced by width — and at the shallow
 * angle that flatters a widescreen monitor, the result is a thin band of
 * solar system stranded in the middle of a tall screen.
 *
 * Tilting toward top-down on narrow windows doesn't reduce that distance, but
 * it roughly doubles the vertical space the system occupies, which is what
 * actually makes it feel framed rather than lost.
 */
export function viewDirectionForAspect(aspect: number): Vector3 {
  const t = MathUtils.clamp((1.6 - aspect) / (1.6 - 0.6), 0, 1);
  const elevation = MathUtils.lerp(0.62, 1.9, t);
  return new Vector3(0, elevation, 1.45).normalize();
}

/** Points sampled around the outermost ring when testing a candidate distance. */
const SAMPLES = 64;

/** How far outside a planet we hover, as a multiple of its radius. */
export const HOVER_DISTANCE_FACTOR = 7;
/** Sine of the elevation angle held while hovering — slightly above level. */
const HOVER_ELEVATION = 0.3;

/**
 * Where the camera comes to rest when parked beside a planet: outside it, at
 * a fixed elevation, on whichever side we approached from.
 *
 * Deliberately *idempotent* — feed its own output back in as `approachFrom`
 * and it returns the same point. That property is what removes the swing on
 * arrival. The flight ends here, then CameraRig recomputes its own target the
 * instant the phase flips to `focused`; if the two disagreed even slightly the
 * camera would visibly correct itself, which is exactly the lurch a naive
 * "normalise the offset and add a Y lift" version produces (adding the lift
 * after normalising changes the vector's length, so reapplying it moves the
 * point every time).
 */
export function hoverPosition(
  planetPosition: Vector3,
  approachFrom: Vector3,
  distance: number,
  out: Vector3
): Vector3 {
  let dx = approachFrom.x - planetPosition.x;
  let dz = approachFrom.z - planetPosition.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) {
    // Directly above or below the planet: no horizontal direction to keep.
    dx = 0;
    dz = 1;
  } else {
    dx /= length;
    dz /= length;
  }

  const horizontal = Math.sqrt(1 - HOVER_ELEVATION * HOVER_ELEVATION);
  return out.set(
    planetPosition.x + dx * horizontal * distance,
    planetPosition.y + HOVER_ELEVATION * distance,
    planetPosition.z + dz * horizontal * distance
  );
}

/**
 * Fractions of the viewport to keep clear, in normalised device coordinates
 * (the NDC box runs -1..1, so 0.24 reserves 12% of the height).
 */
export type FrameMargins = { top: number; bottom: number; side: number };

/**
 * Smallest camera distance at which the whole system fits on screen.
 *
 * A hardcoded distance can't work, for two reasons:
 *
 *  1. The system is a flat disc viewed at an angle, so its *near* edge is far
 *     closer to the camera than its centre and swings much further off the
 *     view axis. At 1.45x the system radius that near edge lands ~31 degrees
 *     off-axis while half of a 50 degree vertical FOV is only 25 — the outer
 *     ring falls outside the frustum and gets clipped along the bottom.
 *  2. Vertical FOV is fixed but horizontal FOV scales with aspect ratio, so
 *     the binding constraint changes with window shape. A distance tuned on a
 *     wide monitor clips on a tall phone.
 *
 * So rather than deriving a closed-form answer for an oblique disc, this
 * binary-searches the distance and *measures*: project sample points around
 * the outer ring through a candidate camera and check they all land inside
 * the margins. Runs on mount and on resize only, never per frame.
 */
export function fitSystemDistance(
  aspect: number,
  radius: number,
  direction: Vector3,
  margins: FrameMargins
): number {
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100000);
  const origin = new Vector3();
  const point = new Vector3();

  const fits = (distance: number) => {
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(origin);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    for (let i = 0; i < SAMPLES; i++) {
      const angle = (i / SAMPLES) * Math.PI * 2;
      point
        .set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
        .project(camera);

      // Points behind the camera project back into the -1..1 box with flipped
      // signs, which would read as a false pass. NDC depth catches them.
      if (point.z < -1 || point.z > 1) return false;
      if (point.x < -1 + margins.side || point.x > 1 - margins.side) return false;
      if (point.y < -1 + margins.bottom || point.y > 1 - margins.top) return false;
    }
    return true;
  };

  let low = radius * 0.5;
  let high = radius * 16;

  // Nothing fits even at maximum range (an extremely thin window). Take the
  // best available rather than returning something that definitely clips.
  if (!fits(high)) return high;

  for (let i = 0; i < 26; i++) {
    const mid = (low + high) * 0.5;
    if (fits(mid)) high = mid;
    else low = mid;
  }
  return high;
}
