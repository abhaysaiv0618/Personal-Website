"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import AboutMePage from "../../app/about-me/page";
import EducationPage from "../../app/education/page";
import ExperiencePage from "../../app/experience/page";
import ProjectsPage from "../../app/projects/page";
import ContactPage from "../../app/contact/page";

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
const SPIN_MS = 7000; // wheel spin duration (much longer for complex animation)

export default function GraphNav({ onSelect }: GraphNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Deterministic sizing (no loops)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Replayable spin key (to restart CSS animation)
  const [spinKey, setSpinKey] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [isHoveringHome, setIsHoveringHome] = useState(false);

  // Sphere expansion state
  const [expandingNode, setExpandingNode] = useState<NavNode | null>(null);
  const [expansionProgress, setExpansionProgress] = useState(0);
  const [expansionOrigin, setExpansionOrigin] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [showContent, setShowContent] = useState(false);

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

  // Show content only when we have a size (prevents initial snap)
  useEffect(() => {
    if (size.w > 0 && size.h > 0) {
      // Add extra delay to ensure background is fully loaded
      const readyTimer = setTimeout(() => {
        setReady(true);
      }, 100);

      if (!reduced) {
        // run initial spin once after a longer delay to make it more noticeable
        const spinTimer = setTimeout(() => {
          setSpinKey((k) => k + 1);
        }, 1000); // increased delay to 1000ms
        return () => {
          clearTimeout(readyTimer);
          clearTimeout(spinTimer);
        };
      }

      return () => clearTimeout(readyTimer);
    }
  }, [size.w, size.h, reduced]);

  // Click handler
  function activate(node: NavNode, evtTarget?: HTMLElement) {
    // blur active element to avoid focus ring lingering
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // For HOME: close any open content, then spin and notify parent
    if (node.id === "home") {
      // Close any open content first
      if (showContent) {
        closeContent();
        return;
      }

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
      // For satellite nodes: start sphere expansion
      if (!reduced) {
        startSphereExpansion(node);
      } else {
        onSelect?.(node, { x: cx, y: cy });
      }
    }
  }

  // Sphere expansion animation
  function startSphereExpansion(
    node: NavNode,
    buttonPosition?: { x: number; y: number }
  ) {
    setExpandingNode(node);
    setExpansionProgress(0);

    // Use button position if provided, otherwise use center
    const origin = buttonPosition || { x: cx, y: cy };
    setExpansionOrigin(origin);

    // Animate expansion
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setExpansionProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Expansion complete, show content instead of navigating
        setTimeout(() => {
          setShowContent(true);
        }, 200);
      }
    }

    requestAnimationFrame(animate);
  }

  // Render content based on selected node
  function renderContent(node: NavNode) {
    switch (node.id) {
      case "about":
        return <AboutMePage />;
      case "education":
        return <EducationPage />;
      case "experience":
        return <ExperiencePage />;
      case "projects":
        return <ProjectsPage />;
      case "contact":
        return <ContactPage />;
      default:
        return null;
    }
  }

  // Close content and return to graph
  function closeContent() {
    setShowContent(false);
    setExpandingNode(null);
    setExpansionProgress(0);
  }

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full h-[65vh] sm:h-[70vh] lg:h-[72vh]",
        !ready && "invisible opacity-0" // hide until centered layout is ready
      )}
      style={{
        minHeight: ready ? "auto" : "65vh", // ensure container has proper height
      }}
    >
      {/* Sphere expansion overlay */}
      {expandingNode && (
        <>
          {/* Blue-green background overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              background: `radial-gradient(circle at ${expansionOrigin.x}px ${expansionOrigin.y}px, 
                rgba(34, 211, 238, 0.1) 0%, 
                rgba(20, 184, 166, 0.15) 30%, 
                rgba(6, 182, 212, 0.2) 60%, 
                rgba(14, 165, 233, 0.25) 100%)`,
              opacity: expansionProgress,
              transition: "opacity 100ms ease-out",
            }}
          />

          {/* Expanding sphere with curvature effect */}
          <div
            className="absolute inset-0 pointer-events-none z-30"
            style={{
              background: `radial-gradient(ellipse ${size.w * 2}px ${
                size.h * 2
              }px at ${expansionOrigin.x}px ${expansionOrigin.y}px,
                rgba(34, 211, 238, 0.8) 0%,
                rgba(20, 184, 166, 0.6) 40%,
                rgba(6, 182, 212, 0.4) 70%,
                transparent 100%)`,
              clipPath: `circle(${
                expansionProgress * Math.max(size.w, size.h) * 0.8
              }px at ${expansionOrigin.x}px ${expansionOrigin.y}px)`,
              transition: "clip-path 50ms ease-out",
            }}
          />

          {/* Section title */}
          <div
            className="absolute top-6 left-6 text-white/90 font-medium text-lg z-40 pointer-events-none"
            style={{
              opacity: expansionProgress,
              transform: `translateY(${(1 - expansionProgress) * 20}px)`,
              transition: "opacity 200ms ease-out, transform 200ms ease-out",
            }}
          >
            {expandingNode.label}
          </div>
        </>
      )}

      {/* Content display area */}
      {showContent && expandingNode && (
        <>
          {/* Dimmed background */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={closeContent}
          />

          {/* Content container */}
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-8"
            style={{
              clipPath: `circle(${Math.max(size.w, size.h) * 0.4}px at ${
                expansionOrigin.x
              }px ${expansionOrigin.y}px)`,
            }}
          >
            {/* Close button */}
            <button
              onClick={closeContent}
              className="absolute top-4 right-4 z-60 bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm transition-colors"
              aria-label="Close"
            >
              ×
            </button>

            {/* Scrollable content */}
            <div className="w-full h-full overflow-y-auto bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-2xl backdrop-blur-sm">
              {renderContent(expandingNode)}
            </div>
          </div>
        </>
      )}

      {/* Static container for HOME only */}
      <div className="absolute inset-0">
        {/* HOME (center hub) - static, doesn't spin */}
        <button
          type="button"
          className={clsx(
            "absolute -translate-x-1/2 -translate-y-1/2",
            "rounded-full select-none text-white/95 font-medium cursor-pointer",
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
          onMouseEnter={() => {
            console.log("Hovering HOME - starting continuous spin");
            setIsHoveringHome(true);
          }}
          onMouseLeave={() => {
            console.log("Leaving HOME - stopping continuous spin");
            setIsHoveringHome(false);
          }}
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

        {/* Spinning container - edges + satellites spin together around HOME center */}
        <div
          ref={wheelRef}
          className={clsx(
            "absolute inset-0",
            !reduced && `satellites-spin-${spinKey}`, // unique class to restart animation
            !reduced && isHoveringHome && "satellites-hover-spin" // continuous spin on hover
          )}
          style={{ transformOrigin: "50% 50%" }}
        >
          {/* Edges layer (spins with satellites) */}
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

          {/* Satellites */}
          {positions.map(({ node, x, y }, i) => {
            return (
              <button
                key={node.id}
                type="button"
                className={clsx(
                  "absolute -translate-x-1/2 -translate-y-1/2",
                  "rounded-full select-none text-white/90 font-medium cursor-pointer",
                  "backdrop-blur-[1px] border border-[#C0C0C0]/60",
                  "bg-transparent hover:bg-cyan-500/20",
                  "hover:scale-[1.06] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]",
                  "hover:border-cyan-400/80 transition-all duration-150 ease-out",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                )}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: NODE_DIAM,
                  height: NODE_DIAM,
                }}
                aria-label={node.label}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const containerRect =
                    containerRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    const buttonPosition = {
                      x: rect.left + rect.width / 2 - containerRect.left,
                      y: rect.top + rect.height / 2 - containerRect.top,
                    };
                    startSphereExpansion(node, buttonPosition);
                  } else {
                    activate(node, e.currentTarget);
                  }
                }}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
