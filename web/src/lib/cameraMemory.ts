import { Vector3 } from "three";

/**
 * Where the camera was parked when it began its descent.
 *
 * Needed because coming back has to return you to the *same* vantage you left
 * from. `hoverPosition` picks its spot from whichever side you approached the
 * planet on, so feeding it an arbitrary direction on the way back would put
 * you on the far side of the planet — technically a valid hover position, and
 * obviously wrong to anyone who was just there.
 *
 * A module-level Vector3 rather than store state, for the same reason
 * planetRegistry.ts is a plain Map: nothing re-renders when this changes, it
 * is read imperatively inside a frame loop, and putting a value that no
 * component subscribes to into zustand only costs re-renders. It also has to
 * survive the surface scene mounting and unmounting, which rules out a ref in
 * any of the components involved.
 *
 * Note this stores the approach *position*, not a direction. `hoverPosition`
 * is idempotent — feed its own output back in and you get the same point — so
 * handing back the exact position we left from returns the exact place we
 * left, with nothing for CameraRig to correct on the first frame.
 */
const approach = new Vector3();

export function rememberApproach(position: Vector3): void {
  approach.copy(position);
}

export function getApproach(): Vector3 {
  return approach;
}
