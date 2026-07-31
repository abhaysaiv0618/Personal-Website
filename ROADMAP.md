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
`{ id, label, body, color, accent, radiusRatio }` to `PLANETS` and a fully
working planet appears — orbit, speed, spacing, guide ring, nav button,
keyboard slot, landing veil colour and a whole derived surface to stand on.

Each section is dressed as a **real solar-system body**, listed in true order
out from the sun: Mercury=About, Venus=Experience, Earth=Education, Mars=
Projects, Jupiter=Resume, Saturn=Contact. The section is what the visitor is
choosing; the planet is the costume, so hover labels lead with the section and
name the body underneath.

Nothing spatial is stored. Speed falls off as `1/√r` (Kepler) and start angles
step by the golden angle, which keeps the distribution good at any count.

**Sizes are compressed, not real.** `radiusRatio` is the body's true radius in
Earths; `SIZE_COMPRESSION` raises it to a fractional power, turning a 30x spread
into about 2x. Ordering stays honest — Jupiter is unmistakably the giant — while
Mercury stays big enough to click. Only the relative order carries meaning.

**Spacing is a clearance, not a gap.** Orbits are laid out by walking outward
from the sun leaving `MIN_CLEARANCE` between each body's outer edge and the
next. A constant gap has to be sized for the largest pair and then strands the
inner planets, and it fails *silently*: at a constant 4.2 the Jupiter/Saturn
pair cleared each other by 0.11 units, so Saturn's rings would have appeared to
graze Jupiter each time their orbits lined up.

The sun is the first edge in that walk, with two adjustments that are worth
keeping:

- It is measured to the **corona**, not the solid body. `SUN_CORONA_SCALE` is
  shared with `Sun.tsx` so the two cannot disagree about how big the star looks.
- It uses `SUN_CLEARANCE` (4.5), far larger than `MIN_CLEARANCE` (1.8), because
  **geometric separation is not perceptual separation next to a light source.**
  At a plain `MIN_CLEARANCE`, Mercury cleared the corona by 3.8% of the system
  radius and was invisible in the glare — sprint 4's arrangement gave it 9.9%.
  This is the bug that made the About Me planet disappear.

The sun's own radius is the one number in the file capped by hand rather than
derived: its true 109 Earth radii compresses to 2.81, which leaves Mercury
nowhere to go. Capped at 2.2, it still clears Jupiter (3.96 vs 3.06) — a star
smaller than its own planet is wrong to anyone.

`SYSTEM_EXTENT` measures to the outer edge of the outermost body, not its orbit.
Saturn's rings sweep ~3 units past the path its centre follows, and framing to
the orbit alone clips them against the screen edge once per lap.

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

The corollary is easy to miss and cost a visible bug: **a discrete state flip
must still arrive on screen continuously.** `Planet.tsx` drove
`emissiveIntensity` from `isActive` as a React prop, so the moment a flight
arrived the planet *flicked* brighter in one frame. Hover scale had been eased
on the object since sprint 3; the glow beside it had not. Anything that changes
because a store value changed needs easing on the object, not a new prop value.

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

**Selecting a planet flies you there and lands you** — one gesture, no "Land"
button, no pause. `ARRIVAL_HOLD_MS` is 0.

(This reverses the call made while planning, which was an explicit two-step
landing. It was wrong on screen: the ceremony bought a hover state nobody wanted
to sit in and put a click between a recruiter and the content.)

**Approach and descent are one move, and that took four separate fixes.** All
four discontinuities landed on the same frame — arrive, stall, flash, drop:

| Was | Now |
|---|---|
| Flight ran `easeInOutCubic`, arriving at zero velocity | `easeInCoast` — accelerate, then coast in at ~1.25x average, still moving |
| Descent built speed again from rest | Ease-*out*, entering at ~2x average and braking |
| FOV boost returned to baseline on the phase flip | Speed-driven, and the dive continues from wherever the flight left it |
| `emissiveIntensity` switched via a React prop | Eased on the material inside `useFrame`, slower than the scale |
| `controls.target` eased from the *previous* planet on handover | Snapped on the first frame the rig regains the camera |

That last one was the "screen turns the other way". `OrbitControls.update()`
**forces** `camera.lookAt(controls.target)`, and the target was still pointing
at wherever we looked when the camera was handed over. Easing it across whipped
the view back to the planet we had just left and then swung it forward again.
Snapping it makes `update()` a no-op — offset is measured from the new target,
so the position it writes back is the one it already had.

The general shape: **`update()` on a controls object is not a read, it is a
write.** Anything stale on that object gets applied to the camera the moment
you call it, whatever the component that just handed over had set.

The order matters: shortening the pause could never have fixed this, because
the pause was not the problem. Two eases both flattening to zero velocity at
the same instant was. Once the flight coasts in, the descent's job stops being
to *build* momentum and becomes to *receive* it — which is why it now
decelerates, reversing the ease that was correct when it started from a
standstill. Measured across real trips, starting from rest meant up to a **7.8x
speed drop** on the handoff frame; entering at 2x keeps every trip within about
2x either way.

A landing brakes. That it also solves the handoff is the useful part.

Clicking the planet you are *already* focused on re-lands rather than no-opping,
which is the only way back down after returning to orbit.

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
2. **Does the system read too small?** Still unresolved, and now *changed*:
   dressing the sections as real bodies grew `SYSTEM_EXTENT` from 18.9 to 48.9,
   because Jupiter, Saturn and its rings need room the six equal balls did not.
   `BASE_SIZE` was raised to 1.8 to compensate, which recovers most of it — an
   Earth-sized planet now occupies 0.037 of the system's radius against 0.045
   before — but it has never been judged on screen. Lowering `MIN_CLEARANCE`
   compacts everything and all distances re-derive.
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
| Orbit spacing / system size | `MIN_CLEARANCE`, `lib/planets.ts` |
| Overall orbit speed | `SPEED_SCALE`, `lib/planets.ts` |
| Planet size | `BASE_SIZE`, `lib/planets.ts` (sun derives from it) |
| Big-vs-small spread | `SIZE_COMPRESSION`, `lib/planets.ts` |
| Beat before the dive | `ARRIVAL_HOLD_MS`, `lib/cut.ts` |
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
| Rocket framing | `DESIRED_AZIMUTH_DEG` / `VERTICAL_FILL`, `lib/surface.ts` |
