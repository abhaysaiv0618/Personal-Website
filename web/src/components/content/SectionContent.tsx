import { sectionItems } from "@/lib/content";
import { PLANET_SYSTEM } from "@/lib/planets";

/**
 * The whole portfolio as plain, server-rendered markup.
 *
 * A **server component**, and that is the point rather than an implementation
 * detail. This fixes a bug that has existed since the site was built: every
 * word of the portfolio lived inside a client-only modal, so a crawler fetching
 * the page got navigation furniture and no content. Nothing here is behind
 * JavaScript, a canvas, or an interaction.
 *
 * It doubles as the complete linear version of the site for anyone who never
 * sees the 3D scene at all — a screen reader, a text browser, a GPU that gave
 * up on the WebGL context. A <canvas> is one opaque element to assistive
 * technology, so *no* amount of care inside the scene can substitute for this.
 * The scene is the enhancement; this is the page.
 *
 * Visually hidden rather than absent, and rendered from the same
 * sectionItems() the objects and the panel read, so it cannot drift out of
 * date the way a hand-maintained duplicate would.
 */
export default function SectionContent() {
  return (
    <section className="sr-only" aria-label="Portfolio content">
      <h2>Abhaysai Vemula — portfolio</h2>
      <p>
        The interactive version of this page presents each section as a planet
        you fly to and land on. Everything it contains is written out below.
      </p>

      {PLANET_SYSTEM.map((planet) => {
        const items = sectionItems(planet.id);
        // A planet appended to PLANETS with no content yet is a valid state,
        // not an error — it simply has no section here until someone writes one.
        if (items.length === 0) return null;

        return (
          <section key={planet.id} aria-labelledby={`section-${planet.id}`}>
            <h3 id={`section-${planet.id}`}>{planet.label}</h3>

            {items.map((item) => (
              <article key={item.id}>
                <h4>{item.title}</h4>
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {item.href && (
                  <p>
                    <a
                      href={item.href}
                      target={
                        item.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel="noreferrer"
                    >
                      {item.hrefLabel ?? item.title}
                    </a>
                  </p>
                )}
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
}
