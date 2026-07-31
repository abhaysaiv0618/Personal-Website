# 3D Solar System Portfolio — Roadmap

Rebuilding the portfolio navigation as a first-person solar system: six planets
orbiting a sun, click one and your rocket flies you there, land on its surface,
and your info is embedded in that world as objects you interact with.

**Status: sprints 1–4 merged to `main`. Sprint 5 is built on `sprint-5-landing`,
awaiting a visual pass — see "Sprint 5, as built" below for what still needs eyes.**

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
| 5 | Descent, the cut, and a surface to stand on | **built, unverified** |
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
system ──travelTo──▶ traveling ──arrive──▶ focused ──land──▶ descending
   ▲                                        │  ▲                 │
   └───────────── clearFocus ───────────────┘  │           touchDown
                                               │                 ▼
                                  returnToOrbit ──── departing ◀─┴─ surface
                                                         ▲      depart
                                                         └──────┘
```

Six phases for three places to be, because the extra states are not about
where the visitor is — they are about **who owns the camera**:

| Phase | Owner |
|---|---|
| `system`, `focused` | `CameraRig` |
| `traveling` | `Flight` |
| `descending`, `departing` | `Descent` |
| `surface` | `SurfaceControls` |

A new *kind* of camera move means a new phase, not a flag on an old one.
`CameraRig` states its claim positively (`phase === "system" || "focused"`) so
a phase added later defaults to not letting it drive — the safe direction, since
a forgotten exclusion is a camera fight and a forgotten inclusion is a camera
that visibly sits still.

Every transition is guarded **in the store**, not at the call sites. One action
has several entry points and a rule enforced at each will be missed at the next
one added. `clearFocus` is the sharp case: it's wired to the canvas's
`onPointerMissed`, so on a surface, releasing a drag-to-look counts as
"clicked nothing" and would have thrown the visitor back into orbit.

### Seven invariants — breaking any of these caused a real bug

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
(3,500 points), the orbit rings and the surface rocks all opt out with
`raycast={() => null}`. The rings are a correctness issue, not just perf: a ring
is a wide flat disc sitting in front of its planet and would swallow the click
meant for it.

**6. `visible={false}` hides rendering, not existence.**
The solar system is *hidden* rather than unmounted while you're on a surface,
because each orbit is **integrated** (`rotation.y += delta * speed` on a mutable
object) rather than derived from the clock — unmount it and every planet resets
to `startAngle`. Deriving instead isn't free either: freezing orbits during a
flight depends on integration, since you can't pause a shared clock without
tracking accumulated pause time.

But hiding only stops the *renderer*. Anything else walking the scene graph
still sees the subtree, and two things bit here:

- **three's raycaster ignores `visible`** — invisible planets still hit-test.
- **`<Html>` labels are real DOM**, parented to the page rather than drawn by
  the renderer. `focusedId` stays set for the planet you landed on, so its
  label hung in mid-air over the surface, projected from a body 1,200 units
  overhead.

Both are gated on phase in `Planet.tsx`. The general rule: `visible` is a render
optimisation, so anything reading the graph for a purpose *other than drawing*
needs its own guard.

**7. Don't synchronise two timelines — order them.**
The dive runs in `useFrame` (render loop); the veil runs in CSS (compositor).
They will drift and cannot be made to agree. `lib/cut.ts` instead enforces
`VEIL_IN_MS < SWAP_MS <= DESCENT_MS`, so the screen is provably solid before the
world underneath it changes.

The consequence is the whole reason sprint 5 was cheap: **behind an opaque veil
a camera may teleport 1,200 units and nobody can tell.** The exact-handoff
problem that made sprint 4 delicate simply does not arise. The gap between
`SWAP_MS` and `DESCENT_MS` is not slack either — it sets how much of the frame
the planet fills at the moment of the cut.

The one place a deadline still bites is the *return*: `returnToOrbit` fires
while the veil is opaque but already opening, so `Descent` snaps the camera back
to its remembered vantage in a `useLayoutEffect` — synchronously on commit,
before paint and before the next animation frame — rather than on the next
frame, where a single wrong frame would surface as the veil lifts.

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

## Sprint 5, as built — Landing

Landing is an **explicit action**, not automatic on arrival: the flight still
ends at `focused`, and a "Land on *X*" button starts the descent. That keeps the
hover shot a state you can rest in, at the cost of one extra click to content.

The surface is **not the planet**. It's a flat disc at `SURFACE_ORIGIN`
(0, −1200, 0), while the icosahedron you were orbiting sits untouched overhead.
Three cheap tricks do the work of geometry: fog (hides the disc's rim, and does
all the depth cueing on a plane with no other depth information in it), a tinted
hemisphere light (a grey rock under a coloured sky still looks like a grey rock
on Earth), and a palette pulled from the planet's own `color`/`accent` — the two
scenes share no geometry at all, so **colour continuity is the only thread
connecting them.**

Everything about a world is derived from its entry, so adding a section is still
a one-line change: palette from the two colours, rock layout from a seeded PRNG
(mulberry32) hashed off the `id`. Seeded, not random — a returning visitor must
get the same world under the same name.

**Files added:** `lib/cut.ts`, `lib/surface.ts`, `lib/cameraMemory.ts`,
`components/ui/FadeOverlay.tsx`, `components/surface/SurfaceScene.tsx`,
`components/surface/SurfaceControls.tsx`, `components/system/Descent.tsx`.
`Rocket.tsx` finally renders, parked, with a new `engine={false}`.

Three things worth not relitigating:

- **`FadeOverlay` owns the cut timing**, not the 3D scene. The swap has exactly
  one safety condition — the screen must be solid — and the overlay is the
  screen. It fires `touchDown`/`returnToOrbit` on a **timer, not
  `transitionend`**, which doesn't fire in a backgrounded tab and would strand
  the phase machine forever. Fail forward, like `Flight` calling `arrive()` when
  its destination is missing.
- **`SurfaceControls` is not OrbitControls.** OrbitControls orbits *around a
  target*, so turning your head would carry you along an arc and end with you
  looking back at where you stood. Feet planted with free orientation is a
  different scheme, not a configuration of the same one. It sets
  `camera.rotation.order = "YXZ"` — in the default `XYZ` the yaw and pitch
  interact and the horizon rolls as you look around.
- **The descent re-reads the planet's live position every frame**, so orbits do
  *not* freeze during it (unlike a flight). A lerp toward a live target
  self-corrects; `Flight`'s bezier is baked once and can't.

**Still needs eyes.** No visual verification was possible in the session that
built this — the whole sprint is type-checked and lint-clean but unexecuted.
Specifically unproven: whether the veil's timing actually hides the swap, how
deep the dive reads, whether the surface palettes look like their planets, and
whether the return lands without a visible correction.

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

1. **Flight and descent pacing.** Duration, arc shape and the FOV speed cue were
   picked blind and never judged on screen; the descent and cut durations in
   `lib/cut.ts` were then picked the same way. Deliberately deferred to a single
   tuning pass over both, rather than settling the flight and then discovering
   the landing changes what the flight should feel like.
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
| Cut timing / dive depth | `lib/cut.ts` — keep `VEIL_IN < SWAP <= DESCENT` |
| Dive plunge cue | `DIVE_FOV_BOOST`, `components/system/Descent.tsx` |
| Atmosphere thickness | `FOG_DENSITY`, `lib/surface.ts` |
| Surface colours | `surfacePalette()`, `lib/surface.ts` |
| Rock field | `ROCK_COUNT` / `SCATTER_RADIUS`, `lib/surface.ts` |
| Look-around speed | `SENSITIVITY`, `components/surface/SurfaceControls.tsx` |
