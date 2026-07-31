import { create } from "zustand";

/**
 * The phase machine every part of the experience reads from.
 *
 *   system ──select──▶ focused ──launch──▶ traveling ──arrive──▶ surface
 *      ▲                                                            │
 *      └──────────────────────── depart ────────────────────────────┘
 *
 * Sprint 3 implements `system` and `focused`. `traveling` and `surface` are
 * declared now so the shape stays stable when Sprints 4 and 5 fill them in.
 */
export type Phase = "system" | "traveling" | "focused" | "surface";

type SystemStore = {
  phase: Phase;
  /** Planet under the pointer. Purely cosmetic — drives labels and scale. */
  hoveredId: string | null;
  /** Planet we have arrived at. Null means "viewing the whole system". */
  focusedId: string | null;
  /** Planet the rocket is currently flying toward, if any. */
  travelToId: string | null;

  hover: (id: string | null) => void;
  /** Launch. No-op if we're already there or already on our way. */
  travelTo: (id: string) => void;
  /** Flight complete — hand the camera back to CameraRig. */
  arrive: () => void;
  clearFocus: () => void;
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
 */
export const useSystemStore = create<SystemStore>((set, get) => ({
  phase: "system",
  hoveredId: null,
  focusedId: null,
  travelToId: null,

  hover: (id) => set({ hoveredId: id }),

  travelTo: (id) => {
    const { phase, focusedId } = get();
    // Re-clicking where you already are, or interrupting a flight already in
    // progress, would strand the rocket mid-arc with a stale destination.
    if (phase === "traveling" || focusedId === id) return;
    set({ phase: "traveling", travelToId: id });
  },

  arrive: () =>
    set((s) => ({
      phase: "focused",
      focusedId: s.travelToId ?? s.focusedId,
      travelToId: null,
    })),

  clearFocus: () =>
    set({ phase: "system", focusedId: null, travelToId: null }),
}));
