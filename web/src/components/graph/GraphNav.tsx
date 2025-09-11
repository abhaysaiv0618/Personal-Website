"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type NavNode = { id: string; label: string; href: string };
export type GraphNavProps = {
  onSelect?: (node: NavNode, centerPx: { x: number; y: number }) => void;
};

const NODES: NavNode[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About Me", href: "/about" },
  { id: "education", label: "Education", href: "/education" },
  { id: "experience", label: "Experience", href: "/experience" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "contact", label: "Contact", href: "/contact" },
];

// Visual constants (tweak as needed)
const NODE_DIAM = 88; // button diameter (px)
const HOME_DIAM = 104; // home size (px)
const EDGE_STROKE = 2; // svg stroke width
const MARGIN = 24; // min margin from container edge
const SPIN_MS = 600; // wheel spin duration

export default function GraphNav({ onSelect }: GraphNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Deterministic sizing (no loops)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Replayable spin key (to restart CSS animation)
  const [spinKey, setSpinKey] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // ResizeObserver for the container (no layout thrash)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize((prev) =>
          prev.w !== cr.width || prev.h !== cr.height
            ? { w: cr.width, h: cr.height }
            : prev
        );
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Center + radius
  const { cx, cy, radius } = useMemo(() => {
    const w = Math.max(0, size.w);
    const h = Math.max(0, size.h);
    const cx = w / 2;
    const cy = h / 2;

    // Circle radius that avoids collisions and edges
    // Allow some room for node diameter etc.
    const rCandidate =
      Math.min(cx, cy) - Math.max(NODE_DIAM, HOME_DIAM) * 0.7 - MARGIN;
    const radius = Math.max(120, rCandidate); // clamp minimal radius
    return { cx, cy, radius };
  }, [size.w, size.h]);

  // Separate HOME from satellites
  const home = NODES.find((n) => n.id === "home")!;
  const satellites = NODES.filter((n) => n.id !== "home");

  // Evenly spaced polar angles
  const positions = useMemo(() => {
    const n = satellites.length;
    const items = satellites.map((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2; // start at top (12 o'clock)
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { node, angle, x, y };
    });
    return items;
  }, [satellites, cx, cy, radius]);

  // Draw edges once per layout; edges rotate with the wheel
  const edges = useMemo(() => {
    return positions.map(({ node, x, y }) => {
      // Trim so the line stops at the pill edge (approximate by radius)
      const homeR = HOME_DIAM / 2;
      const nodeR = NODE_DIAM / 2;

      const dx = x - cx;
      const dy = y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;

      const x1 = cx + ux * (homeR + 4);
      const y1 = cy + uy * (homeR + 4);
      const x2 = x - ux * (nodeR + 4);
      const y2 = y - uy * (nodeR + 4);

      return { id: node.id, x1, y1, x2, y2 };
    });
  }, [positions, cx, cy]);

  // Trigger initial spin once wheel is measurable
  useEffect(() => {
    if (reduced) return;
    if (size.w > 0 && size.h > 0) {
      // restart animation by bumping key
      setSpinKey((k) => k + 1);
      // clear the class after animation ends so we can replay next time
      const t = setTimeout(() => {
        setSpinKey((k) => k); // no-op, class will be removed by CSS end
      }, SPIN_MS + 30);
      return () => clearTimeout(t);
    }
  }, [size.w, size.h, reduced]);

  // Click handler
  function activate(node: NavNode, evtTarget?: HTMLElement) {
    // blur active element to avoid focus ring lingering
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // For HOME: spin, then notify parent to perform the radial reveal
    if (node.id === "home") {
      if (!reduced) {
        // replay spin
        setSpinKey((k) => k + 1);
        setTimeout(() => {
          onSelect?.(node, { x: cx, y: cy });
        }, SPIN_MS); // wait for wheel spin to complete
      } else {
        onSelect?.(node, { x: cx, y: cy });
      }
    } else {
      // Other nodes: no spin required; pass their center
      onSelect?.(node, { x: cx, y: cy });
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[65vh] sm:h-[70vh] lg:h-[72vh]"
    >
      {/* WHEEL: nodes + edges rotate together */}
      <div
        ref={wheelRef}
        className={clsx(
          "graph-wheel absolute inset-0",
          !reduced && `spin-${spinKey}` // unique class to restart animation
        )}
        style={{ transformOrigin: "50% 50%" }}
      >
        {/* Edges layer (rotates with wheel) */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
        >
          <g>
            {edges.map((e) => (
              <line
                key={e.id}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={EDGE_STROKE}
                strokeLinecap="round"
              />
            ))}
          </g>
        </svg>

        {/* HOME (center hub) */}
        <button
          type="button"
          className={clsx(
            "absolute -translate-x-1/2 -translate-y-1/2",
            "rounded-full select-none text-white/95 font-medium",
            "shadow-[0_0_18px_rgba(255,150,50,0.35)]",
            "bg-[radial-gradient(ellipse_at_center,_rgba(255,180,80,0.95)_0%,_rgba(255,140,60,0.9)_35%,_rgba(255,120,40,0.85)_60%,_rgba(255,120,40,0.2)_100%)]",
            "backdrop-blur-[1px] border border-white/20",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          )}
          style={{
            left: `${cx}px`,
            top: `${cy}px`,
            width: HOME_DIAM,
            height: HOME_DIAM,
          }}
          aria-label="Home"
          onClick={(e) => activate(home, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              activate(home, e.currentTarget);
            }
          }}
        >
          <span className="block w-full h-full grid place-items-center text-sm tracking-wide">
            {home.label}
          </span>
        </button>

        {/* Satellites */}
        {positions.map(({ node, x, y }) => (
          <button
            key={node.id}
            type="button"
            className={clsx(
              "absolute -translate-x-1/2 -translate-y-1/2",
              "rounded-full select-none text-white/90 font-medium",
              "bg-[radial-gradient(ellipse_at_center,_rgba(255,230,150,0.95)_0%,_rgba(255,210,90,0.9)_40%,_rgba(255,190,70,0.85)_65%,_rgba(255,190,70,0.2)_100%)]",
              "backdrop-blur-[1px] border border-white/15",
              "hover:scale-[1.06] transition-transform duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            )}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: NODE_DIAM,
              height: NODE_DIAM,
            }}
            aria-label={node.label}
            onClick={(e) => activate(node, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate(node, e.currentTarget);
              }
            }}
          >
            <span className="block w-full h-full grid place-items-center text-sm">
              {node.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
