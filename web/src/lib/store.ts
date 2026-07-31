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
export type Phase = "system" | "focused" | "traveling" | "surface";

type SystemStore = {
  phase: Phase;
  /** Planet under the pointer. Purely cosmetic — drives labels and scale. */
  hoveredId: string | null;
  /** Planet the camera is committed to. Null means "viewing the whole system". */
  focusedId: string | null;

  hover: (id: string | null) => void;
  focus: (id: string) => void;
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
export const useSystemStore = create<SystemStore>((set) => ({
  phase: "system",
  hoveredId: null,
  focusedId: null,

  hover: (id) => set({ hoveredId: id }),
  focus: (id) => set({ focusedId: id, phase: "focused" }),
  clearFocus: () => set({ focusedId: null, phase: "system" }),
}));
