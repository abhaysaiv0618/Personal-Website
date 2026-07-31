"use client";

import dynamic from "next/dynamic";
import DetailPanel from "@/components/ui/DetailPanel";
import FadeOverlay from "@/components/ui/FadeOverlay";
import NavRing from "@/components/ui/NavRing";
import TitleCard from "@/components/ui/TitleCard";

// WebGL needs a real browser <canvas>, so the scene can never render on the
// server. In the App Router `ssr: false` is only legal inside a client
// component, which is the only reason this wrapper exists — it keeps the
// route itself a server component so Sprint 6 can render crawlable content
// alongside the canvas.
const SolarSystem = dynamic(() => import("./SolarSystem"), {
  ssr: false,
  // No spinner: Cosmos3D is already painted behind the canvas, so a loading
  // state would only introduce a flash of unrelated UI.
  loading: () => null,
});

export default function SceneRoot() {
  // The 3D scene and the DOM overlay are siblings, not nested. Anything
  // inside <Canvas> is rendered by three.js and can't be a <button> — so all
  // real interactive controls live out here, layered on top, and the canvas
  // is the enhancement rather than the mechanism.
  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden">
      <SolarSystem />
      <TitleCard />
      <NavRing />
      {/* z-25: over the nav ring, under the veil. The cut has to be able to
          cover the panel like everything else, or leaving a surface with a
          sheet open would show text floating over a launching rocket. */}
      <DetailPanel />
      {/* Last, and z-30: the veil covers the controls too. Hiding the UI is
          part of selling the cut as a single continuous move rather than a
          scene change with a menu bar sitting on top of it. */}
      <FadeOverlay />
    </div>
  );
}
