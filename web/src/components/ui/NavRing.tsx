"use client";

import { PLANET_SYSTEM, getPlanet } from "@/lib/planets";
import { isBusy, useSystemStore } from "@/lib/store";

/**
 * The persistent planet switcher.
 *
 * This is not a convenience — it is how the experience stays usable without a
 * mouse. A <canvas> is a single opaque element to assistive technology: the
 * planets inside it cannot be tabbed to, announced, or activated by keyboard,
 * no matter how they're written. So the canonical way to reach every section
 * is these real <button>s, and clicking a planet is treated as the shortcut.
 *
 * Building it this way round (DOM first, 3D as enhancement) is what keeps the
 * site navigable for screen readers, keyboard users, and anyone whose GPU
 * gave up on the WebGL context.
 */
export default function NavRing() {
  const focusedId = useSystemStore((s) => s.focusedId);
  const hoveredId = useSystemStore((s) => s.hoveredId);
  const travelToId = useSystemStore((s) => s.travelToId);
  const phase = useSystemStore((s) => s.phase);
  const travelTo = useSystemStore((s) => s.travelTo);
  const hover = useSystemStore((s) => s.hover);
  const clearFocus = useSystemStore((s) => s.clearFocus);
  const land = useSystemStore((s) => s.land);
  const depart = useSystemStore((s) => s.depart);

  // Any scripted move — flight, descent, lift-off. The store ignores input
  // during these anyway; this is so the controls *look* unavailable rather
  // than silently doing nothing.
  const busy = isBusy(phase);
  const onSurface = phase === "surface" || phase === "departing";

  // The one contextual control, which changes what it does with the phase.
  //
  // Deliberately a single button that relabels rather than two buttons that
  // swap places. Landing unmounts nothing, so keyboard focus survives the
  // whole sequence: press Enter to land and focus is still sitting on the
  // control that now says "Return to orbit". Swapping elements would drop
  // focus back to the top of the document at exactly the moment the visitor
  // can't see the screen.
  const actionPlanet = getPlanet(travelToId ?? focusedId ?? "");
  const action = onSurface
    ? { label: "Return to orbit", run: depart }
    : { label: `Land on ${actionPlanet?.label ?? "planet"}`, run: land };

  return (
    <nav
      aria-label="Portfolio sections"
      // pointer-events-none on the wrapper so the strip doesn't block camera
      // dragging; re-enabled on the controls themselves.
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6"
    >
      <ul className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-black/50 px-2 py-2 backdrop-blur-md">
        {PLANET_SYSTEM.map((planet) => {
          // Highlight the destination the moment a flight starts, so the
          // control reflects where you're going rather than where you left.
          const isActive =
            travelToId === planet.id || (!travelToId && focusedId === planet.id);
          return (
            <li key={planet.id}>
              <button
                type="button"
                onClick={() => travelTo(planet.id)}
                // Locked mid-flight and while standing on a surface: the store
                // ignores the launch in both cases anyway, but a button that
                // visibly does nothing is worse than one that shows it's
                // unavailable. From a surface you leave via the action button
                // below, which is one deliberate step rather than a silent
                // teleport out of a world you were reading.
                disabled={busy || onSurface}
                aria-busy={travelToId === planet.id}
                // Hovering a button highlights the matching planet in 3D, so
                // the two navigation surfaces stay visibly linked.
                onMouseEnter={() => hover(planet.id)}
                onMouseLeave={() => hover(null)}
                onFocus={() => hover(planet.id)}
                onBlur={() => hover(null)}
                aria-current={isActive ? "true" : undefined}
                className="rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-default disabled:opacity-55 sm:px-4 sm:text-sm"
                style={{
                  color: isActive || hoveredId === planet.id ? planet.accent : "rgba(255,255,255,0.72)",
                  borderColor:
                    isActive ? `${planet.accent}99` : "rgba(255,255,255,0.12)",
                  backgroundColor: isActive ? `${planet.accent}1f` : "transparent",
                }}
              >
                {planet.label}
              </button>
            </li>
          );
        })}

        {/* Mounted from the moment a destination exists and never unmounted
            until you're back in the system view — see the focus note above. */}
        {actionPlanet && (
          <li>
            <button
              type="button"
              onClick={action.run}
              disabled={busy}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-default disabled:opacity-55 sm:px-4 sm:text-sm"
              style={{
                color: actionPlanet.accent,
                borderColor: `${actionPlanet.accent}aa`,
                backgroundColor: `${actionPlanet.accent}2b`,
              }}
            >
              {action.label}
            </button>
          </li>
        )}

        {focusedId && !onSurface && (
          <li>
            <button
              type="button"
              onClick={clearFocus}
              disabled={busy}
              className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium tracking-wide text-white/60 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-default disabled:opacity-55 sm:px-4 sm:text-sm"
            >
              Back to system
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
