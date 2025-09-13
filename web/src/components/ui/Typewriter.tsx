"use client";

import * as React from "react";

type Props = {
  text: string;
  speedMs?: number; // ms per character
  startDelayMs?: number; // delay before typing starts
  as?: keyof React.JSX.IntrinsicElements; // default 'h1'
  className?: string;
};

export default function Typewriter({
  text,
  speedMs = 60,
  startDelayMs = 200,
  as = "h1",
  className = "",
}: Props) {
  const [display, setDisplay] = React.useState(""); // SSR-safe: initial '' renders the same on server & client
  const [reduced, setReduced] = React.useState(false);

  // Track prefers-reduced-motion
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Type animation
  React.useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return;
    }
    let i = 0;
    let interval: number | undefined;

    setDisplay("");
    const startTimer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i++;
        setDisplay(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(interval);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [text, speedMs, startDelayMs, reduced]);

  const Tag = as as keyof React.JSX.IntrinsicElements;

  return (
    <Tag aria-label={text} className={className}>
      <span>{display}</span>
      {/* caret */}
      {!reduced && (
        <span
          aria-hidden="true"
          className="inline-block w-0.5 h-[1em] align-[-0.15em] bg-indigo-400 ml-1 motion-safe:animate-caret"
        />
      )}
    </Tag>
  );
}
