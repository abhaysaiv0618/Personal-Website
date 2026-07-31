"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera } from "three";
import { CAMERA_FOV } from "@/lib/framing";
import { EYE_HEIGHT, SURFACE_ORIGIN } from "@/lib/surface";

/** Radians of rotation per pixel dragged. */
const SENSITIVITY = 0.0032;
/** Stop short of straight up and straight down; both read as broken. */
const PITCH_LIMIT = Math.PI / 2 - 0.14;

/**
 * Look around from where you're standing.
 *
 * OrbitControls is the wrong tool here and it's worth being precise about why:
 * it orbits the camera *around a target point*, so turning your head would
 * carry you sideways along an arc and end with you looking back at the spot
 * you were standing on. What's wanted is the opposite — position pinned,
 * orientation free. That is a different control scheme, not a configuration of
 * the same one, so this owns the camera outright during `surface` (see the
 * ownership table in lib/store.ts) and OrbitControls is disabled.
 *
 * The camera being *placed* here is also the second half of the landing cut.
 * The dive ends wherever it ends, a thousand units above; this sets position
 * and orientation from scratch on mount. Both happen while the veil is opaque,
 * which is precisely why neither has to agree with the other.
 */
export default function SurfaceControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Orientation as two angles rather than read back off the camera each time.
  // Decomposing a quaternion into yaw and pitch every pointer move invites
  // gimbal weirdness near the poles; keeping the angles as the source of truth
  // and writing them down to the camera avoids the round trip entirely.
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    const element = gl.domElement;

    // Stand up. Position, orientation and lens are all set outright — nothing
    // is inherited from the descent, because behind an opaque screen there is
    // nothing to inherit.
    camera.position.copy(SURFACE_ORIGIN);
    camera.position.y += EYE_HEIGHT;

    // YXZ means yaw is applied about the world's Y axis and pitch about the
    // camera's own X. In the default XYZ order the two interact and the
    // horizon rolls as you look around — the classic "drunk camera" bug.
    camera.rotation.order = "YXZ";
    yaw.current = 0;
    pitch.current = 0;
    camera.rotation.set(0, 0, 0);

    // Flight leaves the lens wide if it was interrupted; the surface is not a
    // moving shot and a boosted FOV would read as distortion.
    const perspective = camera as PerspectiveCamera;
    if (perspective.isPerspectiveCamera && perspective.fov !== CAMERA_FOV) {
      perspective.fov = CAMERA_FOV;
      perspective.updateProjectionMatrix();
    }

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      // Pointer capture is what makes a drag survive leaving the canvas.
      // Without it, dragging past the edge of the window silently stops
      // turning and the camera sticks mid-motion.
      element.setPointerCapture(event.pointerId);
      element.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (event.clientX - lastX) * SENSITIVITY;
      pitch.current = MathUtils.clamp(
        pitch.current - (event.clientY - lastY) * SENSITIVITY,
        -PITCH_LIMIT,
        PITCH_LIMIT
      );
      lastX = event.clientX;
      lastY = event.clientY;
      camera.rotation.set(pitch.current, yaw.current, 0);
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      element.style.cursor = "grab";
    };

    element.style.cursor = "grab";
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.style.cursor = "auto";
      // Hand the camera back in the state the rest of the app expects. Leaving
      // YXZ set would not break OrbitControls, which writes a quaternion, but
      // it would quietly change how anything reading camera.rotation behaves.
      camera.rotation.order = "XYZ";
    };
  }, [camera, gl]);

  return null;
}
