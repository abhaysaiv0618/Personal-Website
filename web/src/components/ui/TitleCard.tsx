"use client";

import { useEffect, useState } from "react";
import { useSystemStore } from "@/lib/store";

/** How long the title lingers before dissolving. */
const HOLD_MS = 3600;

/**
 * Name and title over the system on arrival, then out of the way.
 *
 * The design decision here is that there is no intro sequence to sit through:
 * the planets are already orbiting when this fades in, and any interaction
 * dismisses it early. A recruiter with the tab open for twenty seconds should
 * spend none of them watching a cinematic.
 */
export default function TitleCard() {
  const [visible, setVisible] = useState(true);
  const phase = useSystemStore((s) => s.phase);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Leaving the system view means they've started exploring — get out of the
  // way at launch rather than on arrival, so the title isn't sitting over the
  // rocket for the whole flight.
  useEffect(() => {
    if (phase !== "system") setVisible(false);
  }, [phase]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-4 pt-10 text-center transition-opacity duration-1000 sm:pt-16 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      // Hidden from assistive tech once faded: the same name and role are
      // already in the page heading structure, and a decorative duplicate
      // announcing itself is noise.
      aria-hidden={!visible}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
        Abhaysai Vemula
      </h1>
      <p className="mt-2 text-sm text-white/70 sm:text-base">
        Software Engineer, Gen AI at Capital One
      </p>
      <p className="mt-4 text-xs text-white/40 sm:text-sm">
        Pick a world to explore
      </p>
    </div>
  );
}
