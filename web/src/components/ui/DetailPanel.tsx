"use client";

import { useEffect, useMemo, useRef } from "react";
import { sectionItems } from "@/lib/content";
import { getPlanet } from "@/lib/planets";
import { useSystemStore } from "@/lib/store";

/**
 * What an object on a surface has to say, as a sheet beside it.
 *
 * A sheet rather than a centred modal, and that is the whole design decision.
 * Sprint 5 spent itself on making you *stand somewhere*; covering that place
 * with a dimmed card the instant you interact with it would throw the result
 * away. The world stays lit, the object you clicked stays glowing, and you can
 * still drag to look around with the panel open.
 *
 * The accessibility consequence is that this is a `role="dialog"` but
 * **not** `aria-modal`. Modality is a claim that everything outside is inert,
 * and here it demonstrably isn't. Marking it modal would suppress the fact that
 * the same copy also exists in the hidden section content — convenient, and a
 * lie about the state of the page. The duplication is the honest cost of
 * keeping the world live.
 */
export default function DetailPanel() {
  const activePropId = useSystemStore((s) => s.activePropId);
  const focusedId = useSystemStore((s) => s.focusedId);
  const closeProp = useSystemStore((s) => s.closeProp);

  const planet = getPlanet(focusedId ?? "");
  const item = useMemo(
    () =>
      activePropId
        ? sectionItems(focusedId ?? "").find((i) => i.id === activePropId)
        : undefined,
    [activePropId, focusedId]
  );

  const closeRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus when the panel opened, so it can be handed back. The
  // opener is either the parallel sr-only button or the canvas itself, and this
  // component has no way to know which — reading it off the document at open
  // time works for both. Same pattern as GraphNav's lastFocusedRef.
  const openerRef = useRef<HTMLElement | null>(null);

  const itemId = item?.id;

  useEffect(() => {
    if (!itemId) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProp();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Hand focus back. If the opener has since been unmounted — leaving the
      // surface tears down the sr-only prop list — focus() on a detached node
      // is a no-op and focus falls to the body, which is the right outcome
      // anyway since the thing it was on no longer exists.
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [itemId, closeProp]);

  // No body scroll lock, deliberately, unlike GraphNav's modal. /system is a
  // fixed-height overflow-hidden viewport; there is no background scroll to
  // lock, and setting body.overflow anyway would be copying the shape of a fix
  // without its reason.

  if (!item || !planet) return null;

  const accent = planet.accent;
  const titleId = `prop-title-${item.id}`;

  return (
    // The wrapper is inert so it never blocks a drag-to-look; only the sheet
    // itself takes pointer events. Bottom padding keeps it clear of the nav
    // ring, which sits at the bottom centre on every breakpoint.
    <div className="pointer-events-none absolute inset-0 z-[25] flex items-end justify-center p-3 pb-24 sm:items-center sm:justify-end sm:p-6 sm:pb-24">
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="animate-sheet-enter pointer-events-auto flex max-h-[52dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-black/75 shadow-2xl backdrop-blur-md sm:max-h-[72dvh]"
        style={{ borderColor: `${accent}55` }}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-5"
          style={{
            borderColor: `${accent}33`,
            backgroundColor: `${accent}14`,
          }}
        >
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-sm font-semibold leading-snug sm:text-base"
              style={{ color: accent }}
            >
              {item.title}
            </h2>
            {item.subtitle && (
              <p className="mt-1 text-xs text-white/60 sm:text-sm">
                {item.subtitle}
              </p>
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={closeProp}
            aria-label={`Close ${item.title}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm leading-none transition-colors duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ borderColor: `${accent}66`, color: accent }}
          >
            ×
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed text-white/80 sm:p-5">
          {item.lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}

          {item.href && (
            <a
              href={item.href}
              // Only http(s) destinations leave the page; a mailto: opens a
              // client and a _blank on it leaves a dead tab behind.
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              {item.hrefLabel ?? "Open"}
              <span aria-hidden>→</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
