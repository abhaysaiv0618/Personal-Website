"use client";

import dynamic from "next/dynamic";

// WebGL needs a real browser <canvas>, so the scene can never render on the
// server. In the App Router `ssr: false` is only legal inside a client
// component, which is the only reason this thin wrapper exists — it keeps
// the route itself a server component so Sprint 6 can render crawlable
// content alongside the canvas.
const SolarSystem = dynamic(() => import("./SolarSystem"), {
  ssr: false,
  // No spinner: Cosmos3D is already painted behind the canvas, so a loading
  // state would only introduce a flash of unrelated UI.
  loading: () => null,
});

export default function SceneRoot() {
  // Fills the viewport minus the fixed h-16 header. Sprint 7 makes this
  // genuinely fullscreen when the scene is promoted to "/".
  return (
    <div className="h-[calc(100dvh-4rem)] w-full">
      <SolarSystem />
    </div>
  );
}
