"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type NavNode = { id: string; label: string; href: string };
export type GraphNavProps = {
  onSelect?: (node: NavNode, centerPx: { x: number; y: number }) => void;
};

const NODES: NavNode[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About Me", href: "" },
  { id: "education", label: "Education", href: "" },
  { id: "experience", label: "Experience", href: "" },
  { id: "projects", label: "Projects", href: "" },
  { id: "contact", label: "Contact", href: "" },
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
  function activate(node: NavNode, _evtTarget?: HTMLElement) {
    // blur active element to avoid focus ring lingering
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // For HOME: close any open expansion, then spin and notify parent
    if (node.id === "home") {
      // Close any open expansion first
      if (selectedNode) {
        closeModal();
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
      // For satellite nodes: open modal instead of navigating
      openModal(node);
    }
  }

  // Sphere expansion animation (commented out - unused function with undefined state)
  /*
  function _startSphereExpansion(
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
  */

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
          <div
            className={`relative w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden animate-modal-enter ${
              selectedNode?.id === "education"
                ? "bg-gradient-to-br from-red-900/95 to-red-800/95 border-2 border-red-400/30 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-2 ring-black/20"
                : selectedNode?.id === "contact"
                ? "bg-gradient-to-br from-purple-900/95 to-purple-800/95 border-2 border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.3)] ring-2 ring-black/20"
                : selectedNode?.id === "projects"
                ? "bg-gradient-to-br from-green-900/95 to-green-800/95 border-2 border-green-400/30 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-2 ring-black/20"
                : selectedNode?.id === "experience"
                ? "bg-gradient-to-br from-amber-900/95 to-amber-800/95 border-2 border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-black/20"
                : "bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-cyan-400/30"
            }`}
          >
            {/* Header with glow effect */}
            <div
              className={`relative border-b p-6 ${
                selectedNode?.id === "education"
                  ? "bg-gradient-to-r from-red-500/20 to-red-600/20 border-b-2 border-red-400/30 ring-1 ring-black/30"
                  : selectedNode?.id === "contact"
                  ? "bg-gradient-to-r from-purple-500/20 to-purple-600/20 border-b-2 border-purple-400/30 ring-1 ring-black/30"
                  : selectedNode?.id === "projects"
                  ? "bg-gradient-to-r from-green-500/20 to-green-600/20 border-b-2 border-green-400/30 ring-1 ring-black/30"
                  : selectedNode?.id === "experience"
                  ? "bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-b-2 border-amber-400/30 ring-1 ring-black/30"
                  : "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400/30"
              }`}
            >
              <div
                className={`absolute inset-0 animate-pulse ${
                  selectedNode?.id === "education"
                    ? "bg-gradient-to-r from-red-500/10 to-red-600/10"
                    : selectedNode?.id === "contact"
                    ? "bg-gradient-to-r from-purple-500/10 to-purple-600/10"
                    : selectedNode?.id === "projects"
                    ? "bg-gradient-to-r from-green-500/10 to-green-600/10"
                    : selectedNode?.id === "experience"
                    ? "bg-gradient-to-r from-amber-500/10 to-amber-600/10"
                    : "bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
                }`}
              />
              <div className="relative flex items-center justify-between">
                <h2
                  className={`text-2xl font-bold tracking-wide ${
                    selectedNode?.id === "education"
                      ? "text-yellow-300"
                      : selectedNode?.id === "contact"
                      ? "text-white"
                      : selectedNode?.id === "projects"
                      ? "text-white"
                      : selectedNode?.id === "experience"
                      ? "text-white"
                      : "text-white/90"
                  }`}
                >
                  {selectedNode.label}
                </h2>
                <button
                  onClick={closeModal}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
                    selectedNode?.id === "education"
                      ? "bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-400 hover:text-red-300"
                      : selectedNode?.id === "contact"
                      ? "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-400 hover:text-purple-300"
                      : selectedNode?.id === "projects"
                      ? "bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 text-green-400 hover:text-green-300"
                      : selectedNode?.id === "experience"
                      ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-400 hover:text-amber-300"
                      : "bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-400 hover:text-red-300"
                  }`}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
              {selectedNode.id === "about" ? (
                // About Me specific content with two columns
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left column - Text content */}
                  <div className="flex-1 space-y-4 text-white/80">
                    <p className="text-lg leading-relaxed">
                      Welcome to my website! I am a Software Engineer working at
                      Bank of America and a Computer Science & Business
                      Analytics and Information Technology (BAIT) graduate from
                      Rutgers University Honors College.
                    </p>
                    <p className="text-base leading-relaxed">
                      My experiences both at work and in university have greatly
                      refined my technical skills and provided me with valuable
                      insights. I have taken graduate-level classes in
                      Artificial Intelligence and Advanced Data Management which
                      have challenged me to think of creative solutions but also
                      provided me with a &quot;foot in the door&quot; into the
                      future of the technology ecosystem.
                    </p>
                    <p className="text-base leading-relaxed">
                      This coupled with the rising importance of AI in our daily
                      lives, has led me to hope to pursue a career where I can
                      be at the forefront of these emerging technologies.
                    </p>
                    <p className="text-base leading-relaxed">
                      If you have any questions or want to chat, feel free to
                      reach out! Email:{" "}
                      <span className="text-cyan-300 font-medium">
                        abhaysai.vemula@gmail.com
                      </span>
                    </p>
                  </div>

                  {/* Right column - Image placeholder */}
                  <div className="flex-shrink-0 lg:w-80">
                    <div className="w-full h-64 bg-gradient-to-br from-slate-700/50 to-slate-600/50 border border-cyan-400/30 rounded-lg flex items-center justify-center">
                      <div className="text-center text-white/60">
                        <div className="w-16 h-16 mx-auto mb-3 bg-cyan-500/20 rounded-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-cyan-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Profile Image</p>
                        <p className="text-xs text-white/40">Coming Soon</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedNode.id === "education" ? (
                // Education specific content with two columns
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left column - Text content */}
                  <div className="flex-1 space-y-4 text-white/80">
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold text-yellow-300">
                        Rutgers University Honors College, New Brunswick
                      </h3>
                      <p className="text-lg font-medium text-white/95">
                        Bachelors of Science, Computer Science and Business
                        Analytics & Information Technology
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold text-yellow-300">
                        Honors:
                      </h4>
                      <p className="text-base leading-relaxed text-white/90">
                        Summa Cum Laude, Presidential Scholarship Award
                        Recipient (&lt; 1% acceptance rate), Dean&apos;s List
                        (All Semesters)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold text-yellow-300">
                        Relevant Coursework:
                      </h4>
                      <p className="text-base leading-relaxed text-white/90">
                        Artificial Intelligence (Graduate Level), Advanced Data
                        Management (Graduate Level), Computer Algorithms, Data
                        Structures, Computer Architecture, Software Methodology,
                        Discrete Structures, Time Series Modeling
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold text-yellow-300">
                        Activities:
                      </h4>
                      <p className="text-base leading-relaxed text-white/90">
                        RES, BITS, RUAIR, Sigma Beta Rho
                      </p>
                    </div>
                  </div>

                  {/* Right column - Image placeholder */}
                  <div className="flex-shrink-0 lg:w-80">
                    <div className="w-full h-64 bg-gradient-to-br from-red-900/30 to-red-800/20 border-2 border-red-400/40 rounded-lg flex items-center justify-center ring-1 ring-black/20">
                      <div className="text-center text-white/60">
                        <div className="w-16 h-16 mx-auto mb-3 bg-yellow-500/20 rounded-full flex items-center justify-center ring-1 ring-black/20">
                          <svg
                            className="w-8 h-8 text-yellow-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 14l9-5-9-5-9 5 9 5z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Education Image</p>
                        <p className="text-xs text-white/40">Coming Soon</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedNode.id === "contact" ? (
                // Contact specific content with two columns
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left column - Text content */}
                  <div className="flex-1 space-y-4 text-white/80">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-white">
                        Contact Info
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-blue-400"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90">
                              LinkedIn:
                            </p>
                            <a
                              href="https://linkedin.com/in/abhaysai-vemula"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-300 hover:text-cyan-200 transition-colors duration-200 underline"
                            >
                              Abhaysai Vemula | LinkedIn
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90">
                              Email:
                            </p>
                            <a
                              href="mailto:abhaysai.vemula@gmail.com"
                              className="text-cyan-300 hover:text-cyan-200 transition-colors duration-200 underline"
                            >
                              abhaysai.vemula@gmail.com
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column - Image placeholder */}
                  <div className="flex-shrink-0 lg:w-80">
                    <div className="w-full h-64 bg-gradient-to-br from-slate-700/50 to-slate-600/50 border border-cyan-400/30 rounded-lg flex items-center justify-center">
                      <div className="text-center text-white/60">
                        <div className="w-16 h-16 mx-auto mb-3 bg-cyan-500/20 rounded-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-cyan-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Contact Image</p>
                        <p className="text-xs text-white/40">Coming Soon</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedNode.id === "projects" ? (
                // Projects specific content - table format
                <div className="space-y-6 text-white/80">
                  {/* Projects Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Project 1 */}
                    <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-4 hover:bg-green-500/15 transition-colors duration-200">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        PathNet: CNN-Based Path Prediction in Simulated
                        Environments
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Technologies:
                          </p>
                          <p className="text-sm text-white/80">
                            Python, PyTorch, Matplotlib
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Link:
                          </p>
                          <button
                            className="text-sm text-cyan-300 hover:text-cyan-200 underline bg-transparent border-none cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Project 2 */}
                    <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-4 hover:bg-green-500/15 transition-colors duration-200">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        Bayesian Pathfinding AI for Probabilistic
                        Decision-Making
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Technologies:
                          </p>
                          <p className="text-sm text-white/80">
                            Python, Matplotlib
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Link:
                          </p>
                          <button
                            className="text-sm text-cyan-300 hover:text-cyan-200 underline bg-transparent border-none cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Project 3 */}
                    <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-4 hover:bg-green-500/15 transition-colors duration-200">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        Text Summarizer
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Technologies:
                          </p>
                          <p className="text-sm text-white/80">
                            Python, JavaScript, HTML, CSS, Flask, NLTK, Heapq
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Link:
                          </p>
                          <button
                            className="text-sm text-cyan-300 hover:text-cyan-200 underline bg-transparent border-none cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Project 4 */}
                    <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-4 hover:bg-green-500/15 transition-colors duration-200">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        Random Knights
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Technologies:
                          </p>
                          <p className="text-sm text-white/80">
                            JavaScript, HTML, CSS, Object Oriented Programming
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Link:
                          </p>
                          <button
                            className="text-sm text-cyan-300 hover:text-cyan-200 underline bg-transparent border-none cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Project 5 */}
                    <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-4 hover:bg-green-500/15 transition-colors duration-200">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        BirthdayiMessageBot
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Technologies:
                          </p>
                          <p className="text-sm text-white/80">
                            Python, Py-Imessage, CronJob
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-300 mb-1">
                            Link:
                          </p>
                          <button
                            className="text-sm text-cyan-300 hover:text-cyan-200 underline bg-transparent border-none cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedNode.id === "experience" ? (
                // Experience specific content - vertical timeline
                <div className="space-y-6 text-white/80">
                  {/* Timeline */}
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-amber-400/30"></div>

                    {/* Experience 1 - Left side */}
                    <div className="relative flex items-center mb-8">
                      <div className="w-1/2 pr-8 text-right">
                        <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-4 hover:bg-amber-500/15 transition-colors duration-200">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-400/30">
                              <span className="text-xs text-amber-300 font-medium">
                                BA
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-white">
                              Software Engineer
                            </h4>
                          </div>
                          <p className="text-base text-amber-300 mb-1">
                            Bank of America
                          </p>
                          <p className="text-sm text-white/80">
                            July 2025 - Present
                          </p>
                        </div>
                      </div>
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-amber-400 rounded-full border-2 border-amber-600"></div>
                      <div className="w-1/2 pl-8"></div>
                    </div>

                    {/* Experience 2 - Right side */}
                    <div className="relative flex items-center mb-8">
                      <div className="w-1/2 pr-8"></div>
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-amber-400 rounded-full border-2 border-amber-600"></div>
                      <div className="w-1/2 pl-8">
                        <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-4 hover:bg-amber-500/15 transition-colors duration-200">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-400/30">
                              <span className="text-xs text-amber-300 font-medium">
                                BA
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-white">
                              Software Engineer Intern
                            </h4>
                          </div>
                          <p className="text-base text-amber-300 mb-1">
                            Bank of America
                          </p>
                          <p className="text-sm text-white/80">
                            June 2024 - Aug 2024
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Experience 3 - Left side */}
                    <div className="relative flex items-center mb-8">
                      <div className="w-1/2 pr-8 text-right">
                        <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-4 hover:bg-amber-500/15 transition-colors duration-200">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-400/30">
                              <span className="text-xs text-amber-300 font-medium">
                                MC
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-white">
                              Software Engineer Intern
                            </h4>
                          </div>
                          <p className="text-base text-amber-300 mb-1">
                            Mastercard
                          </p>
                          <p className="text-sm text-white/80">
                            June 2023 - Aug 2023
                          </p>
                        </div>
                      </div>
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-amber-400 rounded-full border-2 border-amber-600"></div>
                      <div className="w-1/2 pl-8"></div>
                    </div>
                  </div>
                </div>
              ) : (
                // Default content for other sections
                <div className="space-y-4 text-white/80">
                  <p className="text-lg leading-relaxed">
                    Welcome to the {selectedNode.label} section! This is where
                    you&apos;ll find detailed information about this topic.
                  </p>
                  <p className="text-base leading-relaxed">
                    Content will be added here in the future. This modal
                    provides a clean, elegant way to display information in a
                    video game-style interface.
                  </p>
                  <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-lg">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-2">
                      Coming Soon
                    </h3>
                    <p className="text-sm text-cyan-200/80">
                      More detailed content and interactive elements will be
                      added to this section.
                    </p>
                  </div>
                </div>
              )}
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
          {positions.map(({ node, x, y }, _i) => {
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
