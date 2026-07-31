// All portfolio copy, lifted out of GraphNav.tsx so it is no longer welded to
// the component that renders it. Sprint 6 renders this twice: once as objects
// in the 3D worlds, once as hidden markup crawlers and screen readers can read.

import { EMAIL, GITHUB_URL, LINKEDIN_URL, RESUME_URL } from "./links";

export const ABOUT = {
  paragraphs: [
    "Welcome to my website! I am a Software Engineer on the Gen AI team at Capital One and a Computer Science & Business Analytics and Information Technology (BAIT) graduate from Rutgers University Honors College.",
    "My experiences both at work and in university have greatly refined my technical skills and provided me with valuable insights. I have taken graduate-level classes in Artificial Intelligence and Advanced Data Management which have challenged me to think of creative solutions but also provided me with a “foot in the door” into the future of the technology ecosystem.",
    "That, coupled with the rising importance of AI in our daily lives, is what drew me to generative AI — and it is what I now build day to day, at the forefront of the technologies I spent university hoping to work on.",
    "If you have any questions or want to chat, feel free to reach out!",
  ],
  email: EMAIL,
};

export type Role = {
  badge: string;
  title: string;
  org: string;
  dates: string;
};

export const EXPERIENCE: Role[] = [
  {
    badge: "C1",
    title: "Software Engineer, Gen AI",
    org: "Capital One",
    dates: "Jan 2026 - Present",
  },
  {
    badge: "BA",
    title: "Software Engineer",
    org: "Bank of America",
    dates: "July 2025 - Jan 2026",
  },
  {
    badge: "BA",
    title: "Software Engineer Intern",
    org: "Bank of America",
    dates: "June 2024 - Aug 2024",
  },
  {
    badge: "MC",
    title: "Software Engineer Intern",
    org: "Mastercard",
    dates: "June 2023 - Aug 2023",
  },
];

export const EDUCATION = {
  school: "Rutgers University Honors College, New Brunswick",
  degree:
    "Bachelors of Science, Computer Science and Business Analytics & Information Technology",
  honors:
    "Summa Cum Laude, Presidential Scholarship Award Recipient (< 1% acceptance rate), Dean’s List (All Semesters)",
  coursework:
    "Artificial Intelligence (Graduate Level), Advanced Data Management (Graduate Level), Computer Algorithms, Data Structures, Computer Architecture, Software Methodology, Discrete Structures, Time Series Modeling",
  activities: "RES, BITS, RUAIR, Sigma Beta Rho",
};

export type Project = {
  title: string;
  tech: string;
  /** A card with a null url renders its title and stack without a dead link. */
  url: string | null;
};

export const PROJECTS: Project[] = [
  {
    title: "PathNet: CNN-Based Path Prediction in Simulated Environments",
    tech: "Python, PyTorch, Matplotlib",
    url: null,
  },
  {
    title: "Bayesian Pathfinding AI for Probabilistic Decision-Making",
    tech: "Python, Matplotlib",
    url: null,
  },
  {
    title: "Text Summarizer",
    tech: "Python, JavaScript, HTML, CSS, Flask, NLTK, Heapq",
    url: null,
  },
  {
    title: "Random Knights",
    tech: "JavaScript, HTML, CSS, Object Oriented Programming",
    url: null,
  },
  {
    title: "BirthdayiMessageBot",
    tech: "Python, Py-Imessage, CronJob",
    url: null,
  },
];

export const RESUME = {
  url: RESUME_URL,
  blurb: "The one-page version, as a PDF.",
};

export const CONTACT = {
  email: EMAIL,
  linkedin: LINKEDIN_URL,
  github: GITHUB_URL,
};

// ---------------------------------------------------------------------------
// One shape for all of it.
//
// The exports above have five different shapes, which was fine when exactly one
// component read them. Sprint 6 renders every section three times — as objects
// standing on a surface, as a detail panel, and as hidden markup for crawlers
// and screen readers — and branching per section in three places is three
// chances for them to disagree about what a section contains.
//
// So everything downstream reads SectionItem and nothing downstream imports
// EXPERIENCE, PROJECTS or the rest directly.
// ---------------------------------------------------------------------------

export type SectionItem = {
  /**
   * Stable across reloads, because it is what the open panel is keyed by.
   * Derived from the section id and the entry's position, not from the title —
   * titles are prose and prose gets edited.
   */
  id: string;
  title: string;
  subtitle?: string;
  /** Body copy. One paragraph per line, in reading order. */
  lines: string[];
  /** Present only when there is somewhere real to go. */
  href?: string;
  hrefLabel?: string;
};

function item(
  sectionId: string,
  index: number,
  rest: Omit<SectionItem, "id">
): SectionItem {
  return { id: `${sectionId}-${index}`, ...rest };
}

/**
 * Everything in a section, as a flat list.
 *
 * The *count* comes from the data rather than from a number written down
 * anywhere: four roles make four monoliths, five projects make five crates. Add
 * a job and an object appears on Venus with no other edit. That is the same
 * promise lib/planets.ts makes about adding a planet, applied one level down.
 *
 * An unknown id returns an empty list rather than throwing. Appending an entry
 * to PLANETS has to keep working on its own — the new world simply has nothing
 * standing on it yet, and filling it in is a separate edit made later.
 */
export function sectionItems(sectionId: string): SectionItem[] {
  switch (sectionId) {
    case "about":
      return [
        item("about", 0, {
          title: "About Me",
          subtitle: "Software Engineer, Gen AI",
          lines: ABOUT.paragraphs,
          href: `mailto:${ABOUT.email}`,
          hrefLabel: ABOUT.email,
        }),
      ];

    case "experience":
      return EXPERIENCE.map((role, i) =>
        item("experience", i, {
          title: role.title,
          subtitle: role.org,
          lines: [role.dates],
        })
      );

    case "education":
      return [
        item("education", 0, {
          title: EDUCATION.school,
          subtitle: EDUCATION.degree,
          lines: [
            EDUCATION.honors,
            `Coursework: ${EDUCATION.coursework}`,
            `Activities: ${EDUCATION.activities}`,
          ],
        }),
      ];

    case "projects":
      return PROJECTS.map((project, i) =>
        item("projects", i, {
          title: project.title,
          lines: [project.tech],
          // Every entry is currently null, which is deliberate: a crate with no
          // link shows its stack and nothing else rather than a dead anchor.
          // Supplying a URL later is a one-line edit with no code change.
          ...(project.url
            ? { href: project.url, hrefLabel: "View project" }
            : {}),
        })
      );

    case "resume":
      return [
        item("resume", 0, {
          title: "Resume",
          lines: [RESUME.blurb],
          href: RESUME.url,
          hrefLabel: "Open the PDF",
        }),
      ];

    case "contact":
      return [
        item("contact", 0, {
          title: "Email",
          lines: [CONTACT.email],
          href: `mailto:${CONTACT.email}`,
          hrefLabel: CONTACT.email,
        }),
        item("contact", 1, {
          title: "LinkedIn",
          lines: ["Work history, and the fastest way to reach me."],
          href: CONTACT.linkedin,
          hrefLabel: "linkedin.com/in/abhaysaivemula",
        }),
        item("contact", 2, {
          title: "GitHub",
          lines: ["Source for most of what is on Mars."],
          href: CONTACT.github,
          hrefLabel: "github.com/abhaysaiv0618",
        }),
      ];

    default:
      return [];
  }
}
