"use client";

import { useEffect, useRef, useState } from "react";
import GraphNav from "@/components/graph/GraphNav";
import Typewriter from "@/components/ui/Typewriter";
import clsx from "clsx";
import { useRouter } from "next/navigation";

type View = "graph" | "revealing" | "hero";

export default function Home() {
  const router = useRouter();

  // View state
  const [view, setView] = useState<View>("graph");

  // Key to force GraphNav re-render for animation restart
  const [graphKey, setGraphKey] = useState(0);

  // Motion preference
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Graph container for sizing + transform origin
  const graphWrapRef = useRef<HTMLDivElement | null>(null);

  // Radial center (in container coords) and radius
  const [origin, setOrigin] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [radius, setRadius] = useState(0);

  // When a node is chosen in the graph
  function handleSelect(
    node: { id: string; label: string; href: string },
    center: { x: number; y: number }
  ) {
    // For Home button, restart the spinning animation
    if (node.id === "home") {
      // Force GraphNav to re-render with new key to restart animation
      setGraphKey((prev) => prev + 1);
      return;
    }

    // For non-Home, keep your existing navigation flow (zoom then route)
    if (!graphWrapRef.current) return;
    const rect = graphWrapRef.current.getBoundingClientRect();
    setOrigin({ x: center.x, y: center.y });

    if (reduced) {
      router.push(node.href);
      return;
    }

    setView("revealing");
    // Scale the graph for a subtle push while routing later
    // (we keep the hero hidden in this branch)
    setTimeout(() => {
      router.push(node.href);
    }, 520);
  }

  // Classes for the graph wrapper
  const graphClasses = clsx(
    "relative z-10 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8",
    view !== "hero" && "pt-8 pb-20",
    // During reveal, graph fades out and ignores input
    view === "revealing" &&
      "pointer-events-none opacity-0 transition-opacity duration-200 motion-safe:scale-[1.2] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out",
    view === "hero"
      ? "opacity-0 pointer-events-none h-0 overflow-hidden m-0 p-0"
      : "opacity-100"
  );

  // Inline style variables for the hero radial clip
  const radialVars: React.CSSProperties =
    view === "hero" || reduced
      ? {} // no clip-path in final state or reduced motion
      : ({
          // Tailwind doesn't type CSS variables; cast is fine
          ["--reveal-x" as any]: `${origin.x}px`,
          ["--reveal-y" as any]: `${origin.y}px`,
          ["--reveal-r" as any]: `${radius}px`,
        } as React.CSSProperties);

  return (
    <section className="purple-space radial-container">
      {/* Graph layer (always mounted for measurements) */}
      <div
        ref={graphWrapRef}
        style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
        className={graphClasses}
        aria-hidden={view !== "graph"}
      >
        <GraphNav key={graphKey} onSelect={handleSelect} />

        {/* Loading overlay for smooth transitions */}
        {view === "revealing" && (
          <div
            className="loading-overlay active"
            style={
              {
                ["--reveal-x" as any]: `${origin.x}px`,
                ["--reveal-y" as any]: `${origin.y}px`,
              } as React.CSSProperties
            }
          />
        )}
      </div>

      {/* Hero revealed via radial clip-path. It sits on top during reveal, then becomes normal flow when view === 'hero'. */}
      <div
        data-state={reduced ? "hero" : view}
        style={radialVars}
        className={clsx(
          "radial-reveal z-20",
          view !== "hero" ? "absolute inset-0" : "relative",
          "mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8"
        )}
        onTransitionEnd={(e) => {
          if (e.propertyName === "clip-path" && view === "revealing") {
            setView("hero");
          }
        }}
      >
        <div className="min-h-[calc(100vh-4rem)] grid place-items-center">
          <div className="hero-content text-center max-w-3xl mx-auto space-y-6 sm:space-y-8">
            <Typewriter
              text={"Welcome to Abhaysai Vemula's Portfolio"}
              speedMs={65}
              startDelayMs={150}
              as="h1"
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white"
            />
            <p className="text-base sm:text-lg text-white/80 leading-relaxed max-w-prose mx-auto">
              Explore my journey through an interactive navigation experience
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
