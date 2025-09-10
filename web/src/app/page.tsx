"use client";

import { useEffect, useRef, useState } from "react";
import GraphNav, { GraphNavProps } from "@/components/graph/GraphNav";
import Typewriter from "@/components/ui/Typewriter";

type View = "graph" | "zooming" | "hero";

export default function Home() {
  const [view, setView] = useState<View>("graph");
  const [origin, setOrigin] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [reduced, setReduced] = useState(false);
  const graphWrapRef = useRef<HTMLDivElement | null>(null);
  const heroHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // Effect to detect reduced motion (client-only)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd();
    mq.addEventListener?.("change", upd);
    return () => mq.removeEventListener?.("change", upd);
  }, []);

  // Handler for node selection
  function handleSelect(
    node: { id: string; label: string; href: string },
    center: { x: number; y: number }
  ) {
    if (node.id !== "home") return; // other nodes navigate inside GraphNav
    // Set transform-origin to the node center and begin zoom
    setOrigin(center);
    if (reduced) {
      setView("hero");
      // move focus to the hero heading next frame
      requestAnimationFrame(() => heroHeadingRef.current?.focus());
    } else {
      setView("zooming");
      // after the zoom animation, reveal the hero
      setTimeout(() => {
        setView("hero");
        requestAnimationFrame(() => heroHeadingRef.current?.focus());
      }, 520); // duration matches transition classes below
    }
  }

  const graphClasses = [
    "relative mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8",
    view !== "hero" ? "pt-8 pb-20" : "",
    view === "zooming"
      ? "motion-safe:scale-125 motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
      : "",
    view === "hero"
      ? "opacity-0 pointer-events-none h-0 overflow-hidden m-0 p-0 transition-opacity duration-300"
      : "opacity-100",
  ].join(" ");

  return (
    <section className="purple-space">
      {/* Graph container (always mounted so sizes can be measured) */}
      <div
        ref={graphWrapRef}
        style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
        className={graphClasses}
        aria-hidden={view === "hero"} // hide from SR once hero is shown
      >
        <GraphNav onSelect={handleSelect} />
      </div>

      {/* Hero (hidden until 'hero' view) */}
      {view === "hero" && (
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="min-h-[calc(100vh-4rem)] grid place-items-center text-center py-8">
            <h1 ref={heroHeadingRef} tabIndex={-1} className="sr-only">
              Hi, I'm Abhaysai Vemula
            </h1>
            {/* visual heading with typing */}
            <Typewriter
              text={"Hi, I'm Abhaysai Vemula"}
              speedMs={65}
              startDelayMs={150}
              as="h2"
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4 outline-none"
            />
            <p className="text-white/80 mb-6">
              Explore my journey through an interactive navigation experience
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="/resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Resume
              </a>
              <a
                href="https://www.linkedin.com/in/abhaysaivemula/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/abhaysaiv0618"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
