# 3D Solar System Portfolio — Roadmap

Rebuilding the portfolio navigation as a first-person solar system: six planets
orbiting a sun, click one and your rocket flies you there, land on its surface,
and your info is embedded in that world as objects you interact with.

**Status: sprints 1–7 built and merged to `main`. Sprint 8 is next.**

Sprint 8 is gated on a real-phone pass. Narrow viewports have been the named top
risk since sprint 6 and are still unverified — `resize_window` reports success
while the captured viewport never changes, so every narrow-screen claim in this
repo is unproven. Promoting the 3D route to `/` makes WebGL the only front door,
which is exactly the wrong moment to discover the bottom sheet is broken. Today a
phone visitor still gets the old wheel, and that fallback disappears at promotion.

---

## Where things stand

| Sprint | What it delivered | State |
|---|---|---|
| 1 | R3F canvas, lit low-poly body, `/system` route | merged |
| 2 | Sun, 6 orbiting planets, orbit rings, starfield, data model | merged |
| 3 | Hover labels, click-to-focus, nav ring, solved camera framing | merged |
| 4 | First-person flight, hover standoff, orbital station-keeping | merged |
| 5 | Descent, the cut, a surface to stand on, and a launch out | merged |
| 6 | Diegetic content on each surface + accessibility | merged |
| 7 | Gaze-driven panel, settlements, weather | merged |
| 8 | Performance tiers, audio, promote to `/` | **next**, gated on a phone pass |

The 3D scene lives at **`/system`**. The old CSS orbit still serves **`/`** and
stays there until sprint 8 promotes the route — that is what keeps the site
shippable throughout, and what makes deploying `/system` unlinked a safe step.

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

Sprint 6 adds one optional field, `propKind`, and holds the promise. It is the
only thing hand-picked about a world's contents: **how many** objects there are
comes from `content.ts::sectionItems(id)`, and **where they stand** comes from a
hash of the id (`lib/props.ts`). An id `sectionItems` doesn't know returns `[]`,
so an appended planet gets a working, empty world rather than a crash — filling
it in stays a separate, later edit.

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

### Eight invariants — breaking any of these caused a real bug

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
`VEIL_DELAY_MS + VEIL_IN_MS <= SWAP_MS <= MOVE_MS`, so the screen is provably
solid before the world underneath it changes — in both directions, which are
timed very differently.

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

**8. A click on an object is not the same event as a click on the canvas.**
R3F applies a 2px movement threshold to `onPointerMissed` and *only* to that.
Object `onClick` handlers are handed the distance as `event.delta` and are
expected to gate themselves, which nothing in the API forces you to notice.

That is fine everywhere in space, where nothing is draggable. It is fatal on a
surface: `SurfaceControls` captures the pointer so you can drag to look around,
so without a `delta` check every look-around that happens to finish with the
cursor over an object would open that object's panel. `SurfaceProps.tsx` checks
it (`CLICK_SLOP`); the planets in orbit deliberately do not, because there is no
drag gesture there to confuse it with.

The general shape: **a library's built-in safety check may cover one of its
entry points and not the others.** Read which.

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

**Leaving is a launch you watch, not a fade.** The two directions through the
cut are shaped as opposites on purpose (`DESCENT` and `ASCENT` in `lib/cut.ts`):

- **Down** — the veil closes immediately, in the planet's accent. It reads as
  dropping into an atmosphere, and there is nothing to watch anyway.
- **Up** — the veil *waits* 1.6s. The rocket lights, leaves the pad and climbs;
  the camera holds still for the first ~600ms so you see it go, then rises after
  it and holds a constant ~39° chase angle. Only then does the screen close.

The veil going up is **black**, and the sky gets there first: `SurfaceScene`
lerps the background toward `SPACE_COLOR`, thins the fog and dims the
hemisphere light as the rocket climbs. So black closes over an already-black
sky and barely registers as a veil. Fading up through the planet's accent —
which is what it used to do — flashed the screen bright at the exact moment you
were supposedly leaving for space.

Two details worth keeping:

- The rocket's height is a **pure function** (`rocketAscent`) used by both
  `SurfaceScene` (to draw it) and `Descent` (to chase it). A shared mutable
  position would work, but two readers of one pure function cannot drift and
  there is nothing to reset between launches.
- Fog thins to 15%, never to zero. With no fog at all the ground disc's rim
  becomes visible from altitude, and a world with a visible edge is worse than
  a hazy one.

This is also the **only scripted camera move in the codebase that has to look
good** rather than merely end in the right place — everything else happens
behind an opaque screen.

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

**What was verified, and what wasn't.** The desktop path — fly, arrive, dive,
stand, look around, launch out, return to orbit — was watched repeatedly and
reworked against what it actually looked like; four of the commits in this
sprint exist only because of that. The session that wrote it had no browser
access, so everything else is type-checked and reasoned but unexecuted.

Sprint 6 ran the browser pass that settled most of this — see below.

## Sprint 6, as built — The content

**The objects on each world are fully derived.** One optional field, `propKind`,
is the only thing hand-picked. The *count* comes from `content.ts::sectionItems`
(four jobs make four monoliths), and the *arrangement* from a hash of the id.
`sectionItems` returns `[]` for an id it doesn't know, so appending to `PLANETS`
still yields a working, empty world rather than a crash.

The planned "3 monoliths" became four, because the count is read from the data
rather than written down.

**The arc is the real constraint on how much a world can hold.** Objects sit on
a 30° arc to the left of centre, at 12.5 units, alternating depth. Every number
there came off the screen:

- The arc is **left** because the rocket parks up to 16° right. Its azimuth is
  aspect-dependent and the props' is not, so the only robust way to stop a phone
  stacking a monolith on the rocket is to keep the two on opposite sides.
- **30°, not 72°.** At 72° you landed on Venus looking at two of the four jobs
  with no way to know the other two existed. At 36° the outermost was still
  clipped. Whatever is on the arc has to fit the frame you land *facing*,
  because nobody goes looking for what they cannot see. Six or seven objects
  would need a second row, not a wider arc.
- **`CLEARING_RADIUS` rose 7 → 17.** The rock field knows nothing about the
  props, so a clearing wide enough to contain them is what stops a monolith
  growing out of a boulder — one constant instead of a collision pass.

**Two things had to be un-derived**, and both are worth keeping:

- **Prop colour is chosen for contrast, not cohesion.** Every other colour on a
  world is derived to sit close to its neighbours, which is what makes the place
  feel like one place. Tinting the props the same way made them dark brown boxes
  on dark brown ground on Mars: present, and invisible. `palette.prop` lifts the
  body colour well clear of the ground.
- **Labels alternate height.** Neighbours are ~7.5° apart on a five-object
  world, far less than a label is wide, and the project titles overlapped into
  an unreadable stack. Separating them vertically is free; separating them
  horizontally would mean a wider arc or truncating titles to nothing.

Labels are **always on** rather than revealed on hover — at most five per world,
and making someone sweep a mouse across an alien plain to discover the slabs are
clickable is a puzzle, not a portfolio. Nothing bobs except the beacon lamp;
idle motion on something resting on the ground reads as a physics bug.

**The panel is a sheet, not a modal.** Sprint 5 spent itself on making you stand
somewhere, and covering that place the instant you interact with it throws the
result away. So the world stays lit, the clicked object stays glowing, and
drag-to-look keeps working. The consequence is that it is a `role="dialog"` but
deliberately **not** `aria-modal`: modality asserts everything outside is inert,
and here it isn't. Claiming it would conveniently hide the fact that the same
copy also lives in the server-rendered content — and would be a lie about the
state of the page. That duplication is what keeping the world live costs.

No new phase was added for it. The six phases arbitrate *camera ownership*, and
the panel takes no camera.

**Accessibility, as built:**
- `SectionContent` is a **server component** rendering every section as plain
  markup. This fixes a bug that had existed since the site was built: all the
  copy lived in a client-only modal, so a crawler got navigation and no content.
  Verified by `curl`ing `/system` and finding every section in the HTML.
- `SurfacePropList` gives each object a real `<button>` — the same argument
  `NavRing` makes for travel, one level down. It is hidden until something
  inside takes focus, then shown: a permanently invisible focusable control is
  its own bug, because a sighted keyboard user tabs in, sees no focus ring
  anywhere, and has lost the page.
- `/system` stays a server component so the above is possible. `SceneRoot`
  exists purely to hold the `ssr: false` boundary WebGL needs.

### Two bugs this sprint found in sprint 5's work

**The sky and fog never worked.** `<color attach="background">` and
`<fogExp2 attach="fog">` were nested inside `<group position={SURFACE_ORIGIN}>`.
`attach` binds to the *direct parent*, so both were assigned to a `Group`, which
has no `background` and no `fog` — three.js reads them off the **scene**. Two of
the three tricks that make a surface read as a place were inert: no sky colour
at all, the CSS starfield visible through the "atmosphere", and a hard rim where
the ground disc ended. Nothing errors; the Group accepts the property and three
never reads it. Fixed by hoisting both to siblings of the group.

**An intermittent "flight never lands" was not a bug at all.** It reproduced
perfectly under browser automation and never in a real browser: Chrome freezes
`requestAnimationFrame` in a backgrounded tab, so `useFrame` never advanced and
the phase machine sat in `traveling`. A fix was written for it and then reverted
once the cause was understood. Worth remembering — **an animation loop tested
through automation is being tested in a tab that may not be rendering**, and
every symptom of that looks exactly like a stuck state machine.

### What sprint 6 actually verified in a browser

Run against `next dev` in Chrome. **Confirmed by watching it:**

- Fly and land as one gesture; the veil, the cut, and the surface underneath.
- Props render on Venus (4 monoliths), Mars (5 crates), Mercury (1 terminal,
  the `count === 1` path) and Saturn (3 beacons, the lamp). All fit the frame
  after the arc change.
- Click a prop → panel opens with the right content, and the object stays lit.
- **Escape closes the panel.**
- **A drag-to-look that ends on an object does not open it** — the `CLICK_SLOP`
  check, invariant 8.
- Focus ring renders on the nav ring; **Enter activates travel**.
- **Reduced motion**: camera moves skipped, cut collapsed, nothing animating.
- **Server-rendered content**: every section present in `curl` output, no JS.

**Not verified, and why:**

- **Full Tab traversal order.** Synthetic Tab did not move focus from `body` in
  this harness. Individual buttons focus and activate correctly; the *order*
  between them was only read off the DOM.
- **Reduced motion via the real media query.** The harness cannot emulate
  `prefers-reduced-motion`, so `useReducedMotion` was temporarily forced to
  `true` and reverted. That exercises everything downstream of the hook but not
  the hook's own `matchMedia` listener.
- **Narrow viewports.** `resize_window` reported success but the captured
  viewport never changed, so the phone layout — bottom sheet, rocket framing —
  is still unproven on a real narrow screen. **The top remaining risk.**
- **Earth (`monument`).** Same single-prop code path as Mercury, not looked at.
- **Departing with props present.** The launch was not re-watched this sprint.

Two things seen and deliberately left alone, both sprint 5 palette questions
rather than sprint 6 work: Mercury's ground reads near-black under a near-white
sky, and Venus's sky is close to blown out. Both are `surfacePalette` tuning.

## Sprint 7 — Inhabited worlds

**The panel opens itself.** Whichever object is nearest the centre of your view
has its panel showing, and it swaps as you turn your head. You land already
facing one, so content is on screen before the veil finishes lifting — no click,
and nothing to discover. Clicking still works and *pins* an object; looking away
past the cone closes an unpinned panel.

`activePropId` split into `pinnedPropId` and `gazedPropId`, and that split is an
accessibility decision rather than a tidiness one. The panel moves focus to its
close button when it opens, which is right for a deliberate open and
catastrophic for an incidental one — gaze changes several times a second, so one
field would have meant focus being yanked continuously and a dialog being
re-announced as fast as a sighted visitor can turn their head. With the source in
the state, a gaze-driven sheet is `aria-hidden` with no focusable children, and a
pinned one is a real dialog. Screen readers already have the whole thing in
`SectionContent` and real buttons in `SurfacePropList`.

Two numbers in `GazeFocus.tsx` are the entire component:

- **A 22° cone.** Without a cutoff the nearest object always wins, so the panel
  could never be empty and there would be no way to just look at the place.
  With it, facing the rocket dismisses — a gesture nobody has to be taught.
- **4° of hysteresis.** With the view exactly between two objects, whichever is
  marginally nearer wins, and that margin flips on sub-pixel camera jitter — the
  panel would swap content every frame. Same shape as a joystick dead zone, and
  equally not optional.

It compares **angles, not screen positions**. Projecting to NDC and taking the
one nearest centre works and silently changes behaviour with window shape; the
angle between the view direction and the object is a property of the world.

The store is written **only when the winner changes** — invariant 1, and the only
reason a per-frame gaze system is affordable at all.

**Each world gets weather and a settlement**, one authored word each in
`planets.ts`, falling back to a value hashed off the id so an appended section
still costs one entry. The fallback hashes the **id, not the array index** —
deriving from position would reshuffle every later planet's character the moment
one was inserted in the middle, and a world has to stay the same world.

Two things about the skyline are worth not relitigating, because both were got
wrong first:

- **Its distance is solved from the world's own fog, not picked.** Exp2 fog
  leaves `exp(-(d·k)²)` of an object, and the per-world fog multipliers span
  nearly 3x — so a radius that reads as a hazy city on a clear world is
  *invisible* on a stormy one. The first version reasoned about the base
  `FOG_DENSITY` and forgot the multiplier: Earth came out 97% fogged and Venus
  99.998%. Now `skylineDistance` solves for a fixed 35% visibility and the
  building sizes scale with it, so the settlement covers the same slice of
  horizon everywhere instead of looming on the worlds with thick air.
- **Cluster centres are evenly spaced from the direction you land facing.**
  They were uniformly random, which is the obvious choice and is wrong here: with
  three clusters it is entirely likely all of them land behind you, and on a
  surface you can turn but you cannot walk. The settlement rendered perfectly,
  sat at z = +65, and was never in shot — which looks exactly like a broken
  instanced mesh, and cost two rounds of debugging in the renderer before the
  position data said otherwise.

The general lesson from the second one: **"it renders but I can't see it" is a
placement question at least as often as a rendering one.** Check where the thing
actually is before you check whether it drew.

**Weather is three layers** (`components/surface/Weather.tsx`): a wrapping
particle field, slow bands drifting across the sky, and — on storm worlds only —
lightning.

The particle volume is a **fixed box around the landing site**, not one that
follows the viewer, and that is only correct because `SurfaceControls` pins the
camera's position and lets you change only its orientation. You look around and
never move, so the weather never has to chase you. In a scene where you could
walk this would have to wrap in the camera's own frame instead.

Two rules on lightning, both load-bearing:

- **It publishes an intensity through `flashRef`; it does not light the scene.**
  Sky colour and hemisphere intensity have exactly one writer, `SurfaceScene`,
  for the same reason the camera has one owner per phase. R3F runs `useFrame` in
  subscription order and **children subscribe before parents**, so a flash
  written inside `Weather` would be overwritten by the parent later in the same
  frame and would never appear. Same silent failure as two components easing one
  camera.
- **Off entirely under reduced motion**, not dimmed or slowed. A full-screen
  brightness strobe is the single most likely thing in this codebase to do
  somebody actual harm.

One frame-rate bug worth remembering: the strike originally set strength to 1 and
decayed it *in the same frame*, so on a slow frame one delta could exceed the
whole decay and the flash would be consumed before it ever drew. `else if` gives
it one guaranteed frame at full strength and makes it frame-rate independent.

### What sprint 7 verified in a browser

**Confirmed by watching it:**

- A panel is **already open on landing**, before the veil finishes lifting, with
  no interaction at all.
- Turning the view swaps the panel to the object you turn toward, with no
  flicker when the view sits between two.
- Facing the rocket **closes** it — the cone acting as a dismiss gesture.
- Clicking pins (the close button appears); Escape unpins and gaze immediately
  takes the panel back, which is the intended fallback rather than a bug.
- Three worlds looked at and clearly distinct: Venus (storm + spires), Earth
  (rain + city), Mars (dust + domes).
- **Lightning**, caught mid-decay with the interval temporarily shortened.
- **Reduced motion with that short interval still in place**: no flash on any
  frame, and consecutive frames pixel-identical because the particles freeze too.
- Departing with weather running: the veil closes black, nothing fights it.

**Not verified:**

- **Narrow viewports**, still. `resize_window` reports success and the captured
  viewport never changes. Now the top risk by some distance — particle counts
  and skyline density both scale badly on a small screen, and the bottom sheet
  has never been seen. Worth ten minutes with a real phone.
- Mercury (`ruins`) and Jupiter (`platforms`) skylines, and Saturn's snow.
- Frame cost. Nothing here has been profiled; sprint 8's perf tiers should gate
  `WEATHER[...].count` and `SKYLINE_COUNT` first, since they are the two numbers
  this sprint added that scale with the device rather than the content.

## Sprint 8 — Polish and promote

Perf tiers (`usePerfTier`, drei `<PerformanceMonitor>`, adaptive DPR), the audio
toggle, the loader, then promote to `/` and delete `GraphNav.tsx`.

`layout.tsx` needs one change at promotion: `<main className="pt-16">` must drop
its padding on the 3D route so the canvas is genuinely fullscreen. The header is
already `fixed z-50` with a translucent backdrop and floats over the scene
correctly as-is.

**Audio needs 4 files** — ambient loop, whoosh, click, land — sourced from
Freesound or similar, or the toggle ships disabled. Muted by default either way.

---

## Known bug — the canvas never sizes itself on load (blocks everything visual)

**The scene is blank for every first-time visitor.** Found while verifying the
route move; it predates that change and reproduces identically on the deployed
`/system`, so it has been shipped this whole time.

Measured on a fresh load of the production build, after a 3s settle:

| | canvas `getBoundingClientRect()` |
|---|---|
| on load | **300 × 150** — the HTML default canvas size |
| after one `window.dispatchEvent(new Event('resize'))` | 1440 × 748, correct |

R3F never measures its container on mount, so the canvas keeps the intrinsic
300×150 default and the scene is invisible. Any resize fires the ResizeObserver,
the canvas takes its real size, and everything renders correctly — sun, six
planets, Saturn's rings, orbit ellipses, starfield, title card. Nothing is wrong
with the scene itself.

Not a stacking or occlusion problem: hiding `.cosmos3d` alone changes nothing,
and `.cosmos3d` is `z-index:-10` behind a positioned canvas ancestor. Not a
context loss: `gl.isContextLost()` is `false` and the drawing buffer is allocated.
The console is clean apart from a `THREE.Clock` deprecation warning.

Prime suspect is the measured container — `SceneRoot`'s
`h-[calc(100dvh-4rem)]` — reporting zero height at the moment R3F measures,
which is a known interaction between `dvh` units and `react-use-measure` under
`ssr:false` dynamic import. Untested; that is the next thing to check.

## Open decisions

1. **Flight and descent pacing.** Duration, arc shape and the FOV speed cue were
   picked blind and never judged on screen; the descent and cut durations in
   `lib/cut.ts` were then picked the same way. Deliberately deferred to a single
   tuning pass over both, rather than settling the flight and then discovering
   the landing changes what the flight should feel like.
2. **Does the system read too small?** ⚠️ **The evidence behind this question was
   an artifact of the canvas-sizing bug below.** "It depends on the window" was
   observed by resizing — and resizing is precisely what makes the canvas size
   itself correctly for the first time. Both readings were taken after a resize,
   so the framing was never actually being judged at its on-load state, which was
   blank. Re-open this only after that bug is fixed. Original note:
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
   `url: null`, so the crates show a tech stack and nothing else. Shipped that
   way by choice in sprint 6; supplying a URL is a one-line edit per project
   with no code change, and the panel grows a link on its own.
5. **Push to production?** Done, and now actually reachable — see *Hosting* below.
   The route move in this commit makes the scene `/` rather than `/system`.

## Hosting — resolved

The earlier note here said the deploy had not landed. That was true when written
and is no longer. Re-measured directly:

| URL | State |
|---|---|
| `personal-website-nine-murex` | 200, `age: 0`, building from `main` with root directory `web/` |
| `personal-website-two-fawn` | still dead; the GitHub repo's `homepage` field still points at it and should be repointed |

Vercel caught up on its own. What was left was not a hosting problem at all: the
scene was built at `/system` and `web/src/app/page.tsx` still rendered the old
`GraphNav`, with nothing anywhere linking the two. A visitor to the root URL had
no path to the site. That is what this commit fixes — the scene now *is* `/`, and
`/system` 308s to it.

GitHub Pages remains enabled and serves root `index.html`, which redirects to
`nine-murex`. That redirect became correct for free once `/` was the scene, but
it is still a third publishing path with a URL hardcoded in a static file and no
way to fail loudly when it goes stale.

**The lesson worth keeping:** every individual signal was green — push landed,
`npm ci && next build` passed, the root URL returned 200 — and the site was still
wrong, because "the build succeeded" and "the right bytes are at the right URL"
are different assertions and only the first was being checked. Verify a deploy by
asserting on *served content*:

```
curl -s https://personal-website-nine-murex.vercel.app/ | grep -o '<title>[^<]*</title>'
```

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
| Cut timing / dive depth | `DESCENT` in `lib/cut.ts` |
| How long you watch the launch | `ASCENT.VEIL_DELAY_MS`, `lib/cut.ts` |
| Launch height / chase framing | `ASCENT_HEIGHT` / `CHASE_GAP`, `lib/surface.ts` |
| Dive plunge cue | `DIVE_FOV_BOOST`, `components/system/Descent.tsx` |
| Atmosphere thickness | `FOG_DENSITY`, `lib/surface.ts` |
| Surface colours | `surfacePalette()`, `lib/surface.ts` |
| Rock field | `ROCK_COUNT` / `SCATTER_RADIUS`, `lib/surface.ts` |
| Per-world weather + settlement | the entry in `lib/planets.ts` |
| What each weather kind does | `WEATHER`, `lib/world.ts` |
| Skyline size / haze target | `SKYLINE_VISIBILITY` / `SKYLINE_REFERENCE`, `lib/world.ts` |
| Settlement silhouettes | `SETTLEMENT`, `lib/world.ts` |
| Weather volume | `VOLUME`, `components/surface/Weather.tsx` |
| Lightning frequency | `STRIKE_INTERVAL`, `components/surface/Weather.tsx` |
| Ground kept clear of rocks | `CLEARING_RADIUS`, `lib/surface.ts` (props must fit inside it) |
| Where the props stand | `PROP_RADIUS` / `ARC_SPAN_DEG` / `STAGGER`, `lib/props.ts` |
| How big each prop is | `PROP_DIMENSIONS`, `lib/props.ts` |
| What counts as "looking at" | `GAZE_CONE_DEG`, `components/surface/GazeFocus.tsx` |
| Panel flicker between objects | `GAZE_HYSTERESIS_DEG`, `components/surface/GazeFocus.tsx` |
| Look-around speed | `SENSITIVITY`, `components/surface/SurfaceControls.tsx` |
| Rocket framing | `DESIRED_AZIMUTH_DEG` / `VERTICAL_FILL`, `lib/surface.ts` |
