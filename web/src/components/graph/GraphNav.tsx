"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Node {
  id: string;
  label: string;
  href: string;
}

export type GraphNavProps = {
  onSelect?: (node: Node, centerPx: { x: number; y: number }) => void;
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

export default function GraphNav({ onSelect }: GraphNavProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [edges, setEdges] = useState<Edge[]>([]);
  const router = useRouter();

  const nodes: Node[] = [
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

    // Calculate radius based on container size, clamped between 140-320px
    const minDimension = Math.min(width, height);
    const baseRadius = minDimension * 0.33;
    const radius = Math.max(140, Math.min(320, baseRadius));

    const positions: Position[] = [];

    // Home node at center
    positions.push({ x: centerX, y: centerY });

    // For very small screens (<380px), use two semi-circles
    if (width < 380) {
      const outerRadius = Math.min(radius + 40, minDimension * 0.4);
      const innerRadius = Math.max(radius - 20, 100);

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

    // Compute edges to all other nodes
    for (let i = 1; i < nodes.length; i++) {
      const node = nodeRefs.current[nodes[i].id];
      if (!node) continue;

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

  // Compute edges after nodes are mounted and positions are available
  useEffect(() => {
    if (!mounted || !positions || positions.length === 0) return;

    // Compute edges after a brief delay to ensure nodes are rendered
    const timeoutId = setTimeout(computeEdges, 10);
    return () => clearTimeout(timeoutId);
  }, [mounted, positions]);

  // Handle node click
  const handleNodeClick = (node: Node) => {
    if (node.id === "home" && onSelect) {
      // For home node, compute center position and call onSelect
      const containerRect = containerRef.current?.getBoundingClientRect();
      const nodeElement = nodeRefs.current[node.id];

      if (containerRect && nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        const x = rect.left - containerRect.left + rect.width / 2;
        const y = rect.top - containerRect.top + rect.height / 2;
        onSelect(node, { x, y });
      }
    } else {
      // For other nodes, navigate normally
      router.push(node.href);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, node: Node) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNodeClick(node);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[520px] md:h-[600px] lg:h-[680px]"
    >
      {/* SVG Edges Layer */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-10 text-purple-400/60 dark:text-purple-300/50"
        style={{ pointerEvents: "none" }}
      >
        {edges.map((edge, index) => (
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

            return (
              <button
                key={node.id}
                ref={(el) => (nodeRefs.current[node.id] = el)}
                className={`
                  absolute rounded-full px-4 py-3 text-sm md:text-base
                  bg-white/90 dark:bg-neutral-900/90 
                  text-neutral-900 dark:text-neutral-100 
                  shadow-sm border border-neutral-200/70 dark:border-neutral-800/70
                  transition-transform motion-safe:duration-200 motion-safe:ease-out
                  hover:motion-safe:scale-110 focus:motion-safe:scale-110
                  shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${isHome ? "font-semibold" : ""}
                `}
                style={{
                  left: position.x - 50, // Center the button (assuming ~100px width)
                  top: position.y - 20, // Center the button (assuming ~40px height)
                  transform: "translate(-50%, -50%)", // Perfect centering
                }}
                onClick={() => handleNodeClick(node)}
                onKeyDown={(e) => handleKeyDown(e, node)}
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
