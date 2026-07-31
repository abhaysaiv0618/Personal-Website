"use client";

import { sectionItems } from "@/lib/content";
import { getPlanet } from "@/lib/planets";
import { useSystemStore } from "@/lib/store";

/**
 * The objects on this surface, as real buttons.
 *
 * NavRing already makes travel work without a mouse; this is the same argument
 * one level down. The props are drawn inside a <canvas>, which means they
 * cannot be tabbed to, announced, or activated no matter how they are written —
 * so the canonical way to open one is a button out here, and clicking the 3D
 * object is the shortcut.
 *
 * Visually hidden **until something inside it takes focus**, then shown as a
 * real panel. A permanently invisible focusable control is its own
 * accessibility bug: a sighted keyboard user tabs into it, sees no focus ring
 * anywhere on screen, and has lost the page. The skip link in layout.tsx uses
 * the same trick for the same reason.
 */
export default function SurfacePropList() {
  const phase = useSystemStore((s) => s.phase);
  const focusedId = useSystemStore((s) => s.focusedId);
  const activePropId = useSystemStore((s) => s.activePropId);
  const openProp = useSystemStore((s) => s.openProp);

  // Only while standing. During `departing` the world is still drawn but the
  // rocket is leaving, and the store would refuse the open anyway.
  if (phase !== "surface") return null;

  const planet = getPlanet(focusedId ?? "");
  if (!planet) return null;

  const items = sectionItems(planet.id);
  if (items.length === 0) return null;

  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-4 focus-within:top-4 focus-within:z-40 focus-within:w-72 focus-within:max-w-[calc(100%-2rem)] focus-within:rounded-2xl focus-within:border focus-within:border-white/15 focus-within:bg-black/85 focus-within:p-3 focus-within:backdrop-blur-md">
      <h2
        className="text-xs uppercase tracking-[0.18em]"
        style={{ color: planet.accent }}
      >
        On {planet.body}: {planet.label}
      </h2>

      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openProp(item.id)}
              // Announced as expanded/collapsed so the state of the panel is
              // available without having to go and find it.
              aria-expanded={activePropId === item.id}
              className="w-full rounded-lg border border-white/10 px-2.5 py-1.5 text-left text-xs text-white/80 transition-colors duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {item.title}
              {item.subtitle && (
                <span className="block text-[0.65rem] text-white/50">
                  {item.subtitle}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
