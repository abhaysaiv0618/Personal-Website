"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Node {
  id: string;
  label: string;
  href: string;
}

interface Position {
  x: number;
  y: number;
}

export default function GraphNav() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [nodePositions, setNodePositions] = useState<Position[]>([]);
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

  // Mount guard for SSR safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!mounted) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
        setNodePositions(calculatePositions(width, height));
      }
    };

    // Initial size calculation
    updateSize();

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [mounted]);

  // Handle node click
  const handleNodeClick = (href: string) => {
    router.push(href);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent, href: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  };

  // Render SVG edges
  const renderEdges = () => {
    if (nodePositions.length < 2) return null;

    const centerNode = nodePositions[0];
    const edgeNodes = nodePositions.slice(1);

    return (
      <svg
        className="absolute inset-0 w-full h-full text-purple-400/50 dark:text-purple-300/40"
        style={{ pointerEvents: "none" }}
      >
        {edgeNodes.map((node, index) => (
          <line
            key={`edge-${index}`}
            x1={centerNode.x}
            y1={centerNode.y}
            x2={node.x}
            y2={node.y}
            stroke="currentColor"
            strokeWidth="1"
            className="transition-opacity duration-200"
          />
        ))}
      </svg>
    );
  };

  // SSR-safe placeholder
  if (!mounted) {
    return (
      <div
        aria-hidden
        className="relative w-full h-[500px] md:h-[600px] lg:h-[700px]"
        style={{ minHeight: "400px" }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] md:h-[600px] lg:h-[700px]"
      style={{ minHeight: "400px" }}
    >
      {/* SVG Edges */}
      {renderEdges()}

      {/* Node Buttons */}
      {nodePositions.map((position, index) => {
        const node = nodes[index];
        const isHome = index === 0;

        return (
          <button
            key={node.id}
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
            onClick={() => handleNodeClick(node.href)}
            onKeyDown={(e) => handleKeyDown(e, node.href)}
            aria-label={`Navigate to ${node.label}`}
          >
            {node.label}
          </button>
        );
      })}
    </div>
  );
}
