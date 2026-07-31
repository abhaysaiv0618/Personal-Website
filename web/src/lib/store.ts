import { create } from "zustand";

/**
 * The phase machine every part of the experience reads from.
 *
 *   system ──travelTo──▶ traveling ──arrive──▶ focused ──land──▶ descending
 *      ▲                                        │  ▲                 │
 *      └───────────── clearFocus ───────────────┘  │           touchDown
 *                                                  │                 ▼
 *                                     returnToOrbit ──── departing ◀─┴─ surface
 *                                                            ▲       depart
 *                                                            └───────┘
 *
 * Six states for what is really three places to be — in the system, beside a
 * planet, on a planet — because the extra states are not about *where the
 * viewer is*. They are about **who owns the camera**:
 *
 *   system, focused        CameraRig       (OrbitControls, eases, station-keeping)
 *   traveling              Flight          (the arc between planets)
 *   descending, departing  Descent         (the dive and the lift-off)
 *   surface                SurfaceControls (drag to look around)
 *
 * Exactly one owner per phase, no blending, ever. Two components easing the
 * same camera toward different targets is stutter the viewer can feel, and it
 * is the bug this whole scheme exists to make impossible. A new kind of camera
 * move therefore means a new phase, not a flag on an old one.
 */
export type Phase =
  | "system"
  | "traveling"
  | "focused"
  | "descending"
  | "surface"
  | "departing";

/** Phases in which the solar system is the thing being looked at. */
export function isInSpace(phase: Phase): boolean {
  return phase !== "surface" && phase !== "departing";
}

/** Phases in which a scripted move is running and input should be ignored. */
export function isBusy(phase: Phase): boolean {
  return (
    phase === "traveling" || phase === "descending" || phase === "departing"
  );
}

type SystemStore = {
  phase: Phase;
  /** Planet under the pointer. Purely cosmetic — drives labels and scale. */
  hoveredId: string | null;
  /** Planet we have arrived at. Null means "viewing the whole system". */
  focusedId: string | null;
  /** Planet the rocket is currently flying toward, if any. */
  travelToId: string | null;

  hover: (id: string | null) => void;
  /** Launch. No-op unless we're in a phase where flying somewhere makes sense. */
  travelTo: (id: string) => void;
  /** Flight complete — hand the camera back to CameraRig. */
  arrive: () => void;
  clearFocus: () => void;

  /** Begin the descent. The veil starts closing on the same tick. */
  land: () => void;
  /** Behind the closed veil: swap the scene. Called by FadeOverlay, not by UI. */
  touchDown: () => void;
  /** Leave the surface. */
  depart: () => void;
  /** Behind the closed veil: swap back to the system. Also FadeOverlay's call. */
  returnToOrbit: () => void;
};

/**
 * A store rather than React Context, because the <Canvas> is its own React
 * reconciler: a provider mounted outside it does not reach the components
 * inside. A store is a plain subscription with no tree involved, so the DOM
 * overlay (NavRing) and the 3D scene (Planet) read the same value without
 * caring which renderer they live in.
 *
 * Note what is deliberately NOT in here: camera position, rotation, anything
 * updated per frame. Those are mutated directly on the Object3D inside
 * useFrame. State that changes 60x a second does not belong in a store —
 * every write would re-render every subscriber.
 *
 * Every transition below is guarded, and the guards live *here* rather than in
 * the components that call them. That is deliberate: a single action has
 * several entry points — a nav-ring button, a click on a planet, a click on
 * empty space — and a rule enforced at each call site is a rule that will be
 * missed at the next one added. clearFocus is the sharp example: it is wired
 * to the canvas's onPointerMissed, so on the surface, releasing a drag to look
 * around counts as "clicked nothing" and would silently throw the viewer back
 * into orbit. The guard fixes that everywhere at once.
 */
export const useSystemStore = create<SystemStore>((set, get) => ({
  phase: "system",
  hoveredId: null,
  focusedId: null,
  travelToId: null,

  hover: (id) => set({ hoveredId: id }),

  travelTo: (id) => {
    const { phase, focusedId } = get();
    // Only from a standing start in space. Interrupting a flight already in
    // progress would strand the rocket mid-arc with a stale destination, and
    // launching from a planet's surface would leave the surface scene mounted
    // with nobody driving the camera.
    if (phase !== "system" && phase !== "focused") return;

    // Already parked here — which happens after returning from this planet's
    // surface. There's no flight to make, but "select a planet" should still
    // end with you standing on it, so drop straight into the descent. Without
    // this, the one planet you cannot revisit is the one you just left.
    if (focusedId === id) {
      if (phase === "focused") set({ phase: "descending" });
      return;
    }

    set({ phase: "traveling", travelToId: id });
  },

  arrive: () =>
    set((s) => ({
      phase: "focused",
      focusedId: s.travelToId ?? s.focusedId,
      travelToId: null,
    })),

  clearFocus: () => {
    const { phase } = get();
    if (phase !== "system" && phase !== "focused") return;
    set({ phase: "system", focusedId: null, travelToId: null });
  },

  land: () => {
    const { phase, focusedId } = get();
    if (phase !== "focused" || !focusedId) return;
    set({ phase: "descending" });
  },

  touchDown: () => {
    if (get().phase !== "descending") return;
    set({ phase: "surface" });
  },

  depart: () => {
    if (get().phase !== "surface") return;
    set({ phase: "departing" });
  },

  returnToOrbit: () => {
    if (get().phase !== "departing") return;
    // focusedId is untouched throughout the whole landing sequence, so we come
    // back to the planet we left rather than having to remember which it was.
    set({ phase: "focused" });
  },
}));
