// All portfolio copy, lifted out of GraphNav.tsx so it is no longer welded to
// the component that renders it. Sprint 6 renders this twice: once as objects
// in the 3D worlds, once as hidden markup crawlers and screen readers can read.

import { EMAIL, GITHUB_URL, LINKEDIN_URL, RESUME_URL } from "./links";

export const ABOUT = {
  paragraphs: [
    "Welcome to my website! I am a Software Engineer working at Bank of America and a Computer Science & Business Analytics and Information Technology (BAIT) graduate from Rutgers University Honors College.",
    "My experiences both at work and in university have greatly refined my technical skills and provided me with valuable insights. I have taken graduate-level classes in Artificial Intelligence and Advanced Data Management which have challenged me to think of creative solutions but also provided me with a “foot in the door” into the future of the technology ecosystem.",
    "This coupled with the rising importance of AI in our daily lives, has led me to hope to pursue a career where I can be at the forefront of these emerging technologies.",
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
    badge: "BA",
    title: "Software Engineer",
    org: "Bank of America",
    dates: "July 2025 - Present",
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
