"use client";
import { useEffect } from "react";

export default function Cosmos3D() {
  // Lightweight parallax: set CSS vars on mouse move. Isolated from graph.
  useEffect(() => {
    const root = document.documentElement;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
      const y = e.clientY / window.innerHeight - 0.5;
      root.style.setProperty("--parx", String(x));
      root.style.setProperty("--pary", String(y));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="cosmos3d pointer-events-none fixed inset-0 -z-10">
      {/* deep star layer (slow) */}
      <div className="layer stars stars-deep" aria-hidden />
      {/* mid star layer (medium) */}
      <div className="layer stars stars-mid" aria-hidden />
      {/* near star layer (faster, brighter twinkle) */}
      <div className="layer stars stars-near" aria-hidden />
      {/* soft nebula/galaxy swirl */}
      <div className="layer nebula" aria-hidden />
      {/* center glow behind the sun (viewport center) */}
      <div className="layer sun-glow" aria-hidden />
      {/* vignette + film grain */}
      <div className="layer vignette" aria-hidden />
      <div className="layer grain" aria-hidden />
    </div>
  );
}
