"use client";

import dynamic from "next/dynamic";
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
    </div>
  );
}
