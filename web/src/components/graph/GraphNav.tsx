"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

export type NavNode = { id: string; label: string; href: string };

export type GraphNavProps = {
  onSelect?: (node: NavNode, centerPx: { x: number; y: number }) => void;
  currentView?: string;
};

interface Position {
  x: number;
  y: number;
}

interface EdgePoint {
  x: number;
  y: number;
}

interface Edge {
  start: EdgePoint;
  end: EdgePoint;
}

export default function GraphNav({
  onSelect,
  currentView,
}: GraphNavProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [animationTime, setAnimationTime] = useState(0);

  const nodes: NavNode[] = [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About Me", href: "/about-me" },
    { id: "education", label: "Education", href: "/education" },
    { id: "experience", label: "Experience", href: "/experience" },
    { id: "projects", label: "Projects", href: "/projects" },
    { id: "contact", label: "Contact", href: "/contact" },
  ];

  // Calculate node positions based on container size
  const calculatePositions = (width: number, height: number): Position[] => {
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate radius based on container size, 30% bigger than before
    const minDimension = Math.min(width, height);
    const baseRadius = minDimension * 0.43; // Increased from 0.33 to 0.43 (30% bigger)
    const radius = Math.max(180, Math.min(420, baseRadius)); // Increased min/max accordingly

    const positions: Position[] = [];

    // Home node at center
    positions.push({ x: centerX, y: centerY });

    // For very small screens (<380px), use two semi-circles
    if (width < 380) {
      const outerRadius = Math.min(radius + 50, minDimension * 0.5); // Increased for bigger graph
      const innerRadius = Math.max(radius - 30, 130); // Increased for bigger graph

      // First semi-circle (top)
      for (let i = 1; i <= 3; i++) {
        const angle = ((i - 1) * Math.PI) / 2; // 0, π/2, π
        const x = centerX + Math.cos(angle) * outerRadius;
        const y = centerY + Math.sin(angle) * outerRadius;
        positions.push({ x, y });
      }

      // Second semi-circle (bottom)
      for (let i = 4; i <= 5; i++) {
        const angle = ((i - 3) * Math.PI) / 2 + Math.PI; // 3π/2, 2π
        const x = centerX + Math.cos(angle) * innerRadius;
        const y = centerY + Math.sin(angle) * innerRadius;
        positions.push({ x, y });
      }
    } else {
      // Standard radial layout
      const outerNodes = nodes.slice(1); // All except home
      outerNodes.forEach((_, index) => {
        const angle = (index * 2 * Math.PI) / outerNodes.length;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        positions.push({ x, y });
      });
    }

    return positions;
  };

  // Geometry helper: normalize vector and compute trimmed edge points
  const computeTrimmedEdge = (
    centerX: number,
    centerY: number,
    nodeX: number,
    nodeY: number,
    centerRadius: number,
    nodeRadius: number,
    padding: number = 2
  ): Edge => {
    const dx = nodeX - centerX;
    const dy = nodeY - centerY;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Guard against zero-length vectors
    if (length === 0) {
      return { start: { x: centerX, y: centerY }, end: { x: nodeX, y: nodeY } };
    }

    // Unit vector
    const ux = dx / length;
    const uy = dy / length;

    // Trimmed endpoints
    const startX = centerX + ux * (centerRadius + padding);
    const startY = centerY + uy * (centerRadius + padding);
    const endX = nodeX - ux * (nodeRadius + padding);
    const endY = nodeY - uy * (nodeRadius + padding);

    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
    };
  };

  // Compute edges based on actual node measurements
  const computeEdges = () => {
    if (!positions || positions.length < 2) {
      setEdges([]);
      return;
    }

    const centerNode = nodeRefs.current[nodes[0].id];
    if (!centerNode) {
      setEdges([]);
      return;
    }

    const centerRect = centerNode.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const centerX = centerRect.left - containerRect.left + centerRect.width / 2;
    const centerY = centerRect.top - containerRect.top + centerRect.height / 2;
    const centerRadius = centerRect.height / 2;

    const newEdges: Edge[] = [];

    // Compute edges to all other nodes using actual rendered positions
    for (let i = 1; i < nodes.length; i++) {
      const node = nodeRefs.current[nodes[i].id];
      if (!node) continue;

      // Get the actual rendered position of the node
      const nodeRect = node.getBoundingClientRect();
      const nodeX = nodeRect.left - containerRect.left + nodeRect.width / 2;
      const nodeY = nodeRect.top - containerRect.top + nodeRect.height / 2;
      const nodeRadius = nodeRect.height / 2;

      const edge = computeTrimmedEdge(
        centerX,
        centerY,
        nodeX,
        nodeY,
        centerRadius,
        nodeRadius
      );

      // Guard against NaN values
      if (
        isFinite(edge.start.x) &&
        isFinite(edge.start.y) &&
        isFinite(edge.end.x) &&
        isFinite(edge.end.y)
      ) {
        newEdges.push(edge);
      }
    }

    setEdges(newEdges);
  };

  // Mount guard for SSR safety
  useEffect(() => {
    setMounted(true);

    // Animation loop for ferris wheel effect
    let animationId: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      setAnimationTime(elapsed);

      if (elapsed < 3000) {
        animationId = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Handle container size measurement with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // initial read
    let frame = requestAnimationFrame(() => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.round(width),
        h = Math.round(height);
      setContainerSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
    });

    // observe subsequent resizes
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const w = Math.round(cr.width),
        h = Math.round(cr.height);
      setContainerSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // Derive node positions from container size using useMemo
  const positions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return null;
    return calculatePositions(containerSize.width, containerSize.height);
  }, [containerSize.width, containerSize.height]);

  // Calculate ferris wheel positions for animation
  const getFerrisWheelPosition = (basePosition: Position, index: number) => {
    if (!isAnimating || index === 0) return basePosition; // Home node doesn't move

    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;

    // Calculate the radius from center to this node
    const radius = Math.sqrt(
      Math.pow(basePosition.x - centerX, 2) +
        Math.pow(basePosition.y - centerY, 2)
    );

    // Calculate the original angle
    const originalAngle = Math.atan2(
      basePosition.y - centerY,
      basePosition.x - centerX
    );

    // Calculate rotation based on time (slowing down over 3 seconds)
    const rotationSpeed = 2; // rotations per second
    const time = animationTime / 1000;
    // Use a smoother easing function for gradual slowdown
    const easing = Math.max(0, Math.pow(1 - time / 3, 2)); // Smooth quadratic slowdown over 3 seconds
    const rotation = (time * rotationSpeed * 360 * easing) % 360;

    // Calculate new angle
    const newAngle = originalAngle + (rotation * Math.PI) / 180;

    // Calculate new position
    const newX = centerX + Math.cos(newAngle) * radius;
    const newY = centerY + Math.sin(newAngle) * radius;

    return { x: newX, y: newY };
  };

  // Compute edges after nodes are mounted and positions are available
  useEffect(() => {
    if (!mounted || !positions || positions.length === 0) return;

    // Compute edges after a brief delay to ensure nodes are rendered
    const timeoutId = setTimeout(computeEdges, 10);
    return () => clearTimeout(timeoutId);
  }, [mounted, positions]);

  // Recompute edges during animation only
  useEffect(() => {
    if (!mounted || !positions || positions.length === 0) return;

    // Only recalculate during animation
    if (isAnimating) {
      requestAnimationFrame(computeEdges);
    }
  }, [animationTime]);

  // Clear edges during node activation to prevent breaking
  const [edgesDisabled, setEdgesDisabled] = useState(false);

  // Re-enable edges when view resets to graph
  useEffect(() => {
    if (currentView === "graph") {
      setEdgesDisabled(false);
    }
  }, [currentView]);

  // Handle node click
  const handleNodeClick = (node: NavNode) => {
    if (!onSelect) return;

    // Immediately clear focus to prevent lingering focus ring
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    nodeRefs.current[node.id]?.blur?.();

    // Disable edges during transition to prevent breaking
    setEdgesDisabled(true);

    // Compute center position and call onSelect for ALL nodes
    const containerRect = containerRef.current?.getBoundingClientRect();
    const nodeElement = nodeRefs.current[node.id];

    if (containerRect && nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;
      onSelect(node, { x, y });
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, node: NavNode) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      // Immediately clear focus to prevent lingering focus ring
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      nodeRefs.current[node.id]?.blur?.();

      // Disable edges during transition to prevent breaking
      setEdgesDisabled(true);

      handleNodeClick(node);
    }
  };

  // Handle transition end to recompute edges after scale animation
  const handleTransitionEnd = () => {
    requestAnimationFrame(computeEdges);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: "calc(100vh - 8rem)" }} // Dynamic height based on viewport
    >
      {/* SVG Edges Layer */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-10 text-purple-400/60 dark:text-purple-300/50"
        style={{ pointerEvents: "none" }}
      >
        {!edgesDisabled &&
          edges.map((edge, index) => (
            <line
              key={`edge-${index}`}
              x1={edge.start.x}
              y1={edge.start.y}
              x2={edge.end.x}
              y2={edge.end.y}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="transition-opacity duration-200"
            />
          ))}
      </svg>

      {/* Node Buttons Layer */}
      <div className="absolute inset-0 z-20">
        {positions &&
          positions.map((position, index) => {
            const node = nodes[index];
            const isHome = index === 0;

            // Get the animated position for ferris wheel effect
            const animatedPosition = getFerrisWheelPosition(position, index);

            return (
              <button
                key={node.id}
                ref={(el) => (nodeRefs.current[node.id] = el)}
                className={`
                  absolute rounded-full px-4 py-3 text-sm md:text-base
                  bg-white/90 dark:bg-neutral-900/90 
                  text-neutral-900 dark:text-neutral-100 
                  shadow-sm border border-neutral-200/70 dark:border-neutral-800/70
                  transition-colors motion-safe:duration-200 motion-safe:ease-out
                  hover:bg-purple-500 hover:text-white focus:bg-purple-500 focus:text-white
                  shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${isHome ? "font-semibold" : ""}
                `}
                style={{
                  left: animatedPosition.x - 50, // Center the button (assuming ~100px width)
                  top: animatedPosition.y - 20, // Center the button (assuming ~40px height)
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => handleNodeClick(node)}
                onKeyDown={(e) => handleKeyDown(e, node)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() =>
                  setHoveredId((prev) => (prev === node.id ? null : prev))
                }
                onFocus={() => setHoveredId(node.id)}
                onBlur={() =>
                  setHoveredId((prev) => (prev === node.id ? null : prev))
                }
                onTransitionEnd={handleTransitionEnd}
                aria-label={`Navigate to ${node.label}`}
              >
                {node.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
