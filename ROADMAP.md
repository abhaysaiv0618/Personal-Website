# 3D Solar System Portfolio — Roadmap

Rebuilding the portfolio navigation as a first-person solar system: six planets
orbiting a sun, click one and your rocket flies you there, land on its surface,
and your info is embedded in that world as objects you interact with.

**Status: sprints 1–4 complete and merged to `main`. Sprint 5 is next.**

Nothing is pushed. `origin/main` is still at `9628d28`, so the live Vercel site
runs the old CSS orbit and still lists Bank of America as the current role.

---

## Where things stand

| Sprint | What it delivered | State |
|---|---|---|
| 1 | R3F canvas, lit low-poly body, `/system` route | merged |
| 2 | Sun, 6 orbiting planets, orbit rings, starfield, data model | merged |
| 3 | Hover labels, click-to-focus, nav ring, solved camera framing | merged |
| 4 | First-person flight, hover standoff, orbital station-keeping | merged |
| 5 | Descent and landing on a surface | **next** |
| 6 | Diegetic content on each surface + accessibility | planned |
| 7 | Performance tiers, audio, promote to `/` | planned |

The 3D scene lives at **`/system`**. The old CSS orbit still serves **`/`** and
stays there until sprint 6 is done — that is what keeps the site shippable
throughout.

## Running it

```bash
cd web && npm run dev      # then open http://localhost:3000/system
```

Do **not** run `npm run build` while a dev server is up. Both write `web/.next`
and the collision leaves every route returning 500 with
`ENOENT: _buildManifest.js.tmp`. Use `npx tsc --noEmit` to verify instead. If it
does happen: kill the servers, `rm -rf web/.next`, restart.

Also check nothing is already on :3000 before starting one. `npm run start`
serves a frozen build and ignores file changes — if the site looks unchanged
after an edit, that is usually why.

---

## Architecture

### Adding a section is a one-line change

`web/src/lib/planets.ts` is the only file to edit. Append
`{ id, label, color, accent }` to `PLANETS` and a fully working planet appears —
orbit, speed, spacing, ring, nav button, keyboard slot.

Orbit radius, orbit speed and start angle are all **derived from array index**,
never stored, so inserting a planet in the middle re-spaces the whole system and
the camera framing widens to suit. Speed falls off as `1/√r` (Kepler) and start
angles step by the golden angle, which keeps the distribution good at any count.

Content lives in `web/src/lib/content.ts` and outbound URLs in
`web/src/lib/links.ts`. The old `GraphNav` reads from both, so the two front
ends cannot drift apart.

### The phase machine

`web/src/lib/store.ts`. Everything hangs off this:

```
system ──travelTo──▶ traveling ──arrive──▶ focused ──travelTo──▶ traveling
   ▲                                          │
   └──────────────── clearFocus ───────────────┘
```

Sprint 5 adds `surface` between `focused` and its exit.

### Five invariants — breaking any of these caused a real bug

**1. Discrete state in the store, continuous state on the object.**
Which planet is hovered or focused re-renders UI, so it lives in zustand.
Camera position, hover scale and flight progress change every frame and no
component needs to re-render for them, so they are mutated directly inside
`useFrame` via refs. Per-frame values in React state re-render every subscriber
60 times a second.

Related: `planetRegistry.ts` is a plain `Map`, not state, because the camera
needs a planet's live world position every frame.

**2. The camera has exactly one owner, arbitrated by phase.**
Three things want it: OrbitControls, `CameraRig`'s scripted eases, and
`Flight`. During `traveling`, `Flight` drives and `CameraRig` returns early
(`CameraRig.tsx`); during a scripted ease, OrbitControls is disabled. Never
blend — two components easing the same object toward different targets is
visible stutter.

**3. Solved framing is one answer, not two numbers.**
`framing.ts::fitSystemDistance` binary-searches for the closest camera distance
at which sample points around the outer ring all project inside the viewport,
with margins reserved for the nav ring. It is solved *for a specific viewing
angle*. Keeping the angle and substituting the distance (or the reverse)
silently voids the guarantee and clips the outer ring. `viewDirectionForAspect`
tilts toward top-down on narrow windows, because a foreshortened disc wastes a
tall screen.

**4. Shared position functions must be idempotent.**
`framing.ts::hoverPosition` returns where the camera parks beside a planet.
`Flight` flies to it and `CameraRig` independently recomputes it on arrival, so
`f(f(x))` must equal `f(x)` or the handoff visibly corrects itself. It forces a
fixed elevation rather than normalising an offset and then adding a Y lift —
adding the lift after normalising changes the vector's length, so reapplying it
moves the point every time.

**5. Not everything should be raycastable.**
Hit-testing walks every raycastable object on every pointer move. The starfield
(3,500 points) and the orbit rings both opt out with `raycast={() => null}`. The
rings are a correctness issue, not just perf: a ring is a wide flat disc sitting
in front of its planet and would swallow the click meant for it.

### Other decisions worth not relitigating

- **Orbits freeze during a flight.** The arc is computed once at launch against
  the destination's position at that instant; a planet that kept moving would
  leave you arriving at empty space. Axial spin keeps running — a fully frozen
  system looks broken rather than paused.
- **Station-keeping needs two parts.** Re-anchor to the planet's live position
  *and* rotate the displacement about the sun by the orbital advance.
  Translating alone holds the distance but slews you around the planet.
- **Measure drift in the right frame.** Co-orbiting *must* show change in world
  space. Verify against the planet's orbital frame or you will reject a correct
  implementation.

---

## Sprint 5 — Landing

**Goal:** descend from the hover position and end standing on a surface with the
rocket parked beside you.

**The key shortcut: do not land on the actual planet sphere.** Curvature and
scale mismatch is a tarpit. Sell it as a cut: camera dives → planet fills the
frame → fade to that planet's atmosphere colour → fade up on a flat surface
scene with the rocket already parked. Continuous to the eye, a fraction of the
work.

**Concepts:** scene swapping and how to hide a cut — fog for depth, a tinted
hemisphere light to sell an alien sky, and how a well-timed fade makes two
unrelated scenes read as one move.

**Files:**
- `components/surface/SurfaceScene.tsx` — ground disc, tinted fog, sky
- `components/ui/FadeOverlay.tsx` — the cut, driven by the phase machine
- `Rocket.tsx` finally gets rendered, parked (it exists and is unused today)
- `store.ts` — implement the `surface` phase and a `depart` action

**Watch for:** the same handoff class of bug as sprint 4. Descent must end
exactly where the surface camera starts, or the cut will reveal a jump.

## Sprint 6 — The content

**Goal:** the info embedded in each world as objects. Experience = 3 monoliths,
Projects = 5 crates, Education = a monument, About = a terminal, Contact and
Resume = beacons. Click one, a panel expands.

Per-planet prop layouts should be declared in `planets.ts` alongside everything
else, so adding a section still means one entry.

**Accessibility is structural here, not a bolt-on.** A canvas is one opaque
element to assistive tech:
- `NavRing` is already real `<button>`s — keyboard travel never touches the canvas
- Every diegetic prop needs a parallel DOM button in an `sr-only` list
- The detail panel must be a real `role="dialog"`; reuse the focus/Escape/scroll-lock
  logic already written in `GraphNav.tsx` (~line 116)
- All section content must render server-side in a visually-hidden container

That last point fixes a bug that exists **today**: content lives inside a
client-only modal, so none of it is crawlable by Google.

## Sprint 7 — Polish and promote

Perf tiers (`usePerfTier`, drei `<PerformanceMonitor>`, adaptive DPR), the audio
toggle, the loader, then promote to `/` and delete `GraphNav.tsx`.

`layout.tsx` needs one change at promotion: `<main className="pt-16">` must drop
its padding on the 3D route so the canvas is genuinely fullscreen. The header is
already `fixed z-50` with a translucent backdrop and floats over the scene
correctly as-is.

**Audio needs 4 files** — ambient loop, whoosh, click, land — sourced from
Freesound or similar, or the toggle ships disabled. Muted by default either way.

---

## Open decisions

1. **Flight pacing.** Duration, arc shape and the FOV speed cue were all picked
   blind and never judged on screen. Sprint 5's landing inherits this pacing, so
   it is cheaper to settle first.
2. **Does the system read too small?** Unresolved since the framing fix. The
   camera sits further back now that it fits the whole system. Dropping
   `ORBIT_GAP` compacts everything and flight distances re-derive automatically.
3. **Should the view angle change on resize?** It currently tilts with window
   shape, which is deliberate but reads as movement. Can be pinned to a constant
   angle at the cost of mobile framing.
4. **Projects have no links.** All five entries in `content.ts` have
   `url: null`, so the crates will show a tech stack and nothing else. Worth
   supplying GitHub URLs before sprint 6.
5. **Push to production?** Two pre-existing bug-fix commits and the Capital One
   update are sitting unpushed on `main`.

## Tuning knobs

| What | Where |
|---|---|
| Orbit spacing / system size | `ORBIT_GAP`, `lib/planets.ts` |
| Overall orbit speed | `SPEED_SCALE`, `lib/planets.ts` |
| Planet size | `BASE_SIZE`, `lib/planets.ts` |
| Flight duration | the `0.28` coefficient, `lib/flightPath.ts` |
| Flight arc height | the `0.16` coefficient, `lib/flightPath.ts` |
| Speed sensation | `SPEED_FOV_BOOST`, `components/system/Flight.tsx` |
| How close you park | `HOVER_DISTANCE_FACTOR`, `lib/framing.ts` |
| Space reserved for UI | `FRAME_MARGINS`, `components/system/CameraRig.tsx` |
