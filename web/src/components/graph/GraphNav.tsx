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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NavNode | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isModalOpen]);

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

    // For HOME: close any open expansion, then spin and notify parent
    if (node.id === "home") {
      // Close any open expansion first
      if (expandingNode) {
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
      // For satellite nodes: do nothing on click
      // Hover effects are preserved in CSS
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
        // Expansion complete - this is the final state, no modal
        // Keep the blue-green expansion visible
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

  // Modal functions
  function openModal(node: NavNode) {
    setSelectedNode(node);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedNode(null);
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
      {/* Video Game Style Modal */}
      {isModalOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-cyan-400/30 rounded-2xl shadow-2xl overflow-hidden animate-modal-enter">
            {/* Header with glow effect */}
            <div className="relative bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-400/30 p-6">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 animate-pulse" />
              <div className="relative flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white/90 tracking-wide">
                  {selectedNode.label}
                </h2>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 flex items-center justify-center text-red-400 hover:text-red-300 transition-all duration-200 hover:scale-110"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4 text-white/80">
                <p className="text-lg leading-relaxed">
                  Welcome to the {selectedNode.label} section! This is where
                  you'll find detailed information about this topic.
                </p>
                <p className="text-base leading-relaxed">
                  Content will be added here in the future. This modal provides
                  a clean, elegant way to display information in a video
                  game-style interface.
                </p>
                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-lg">
                  <h3 className="text-lg font-semibold text-cyan-300 mb-2">
                    Coming Soon
                  </h3>
                  <p className="text-sm text-cyan-200/80">
                    More detailed content and interactive elements will be added
                    to this section.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                onClick={() => {
                  openModal(node);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openModal(node);
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
