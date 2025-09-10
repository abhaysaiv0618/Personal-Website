"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const pathname = usePathname();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle escape key for mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isMobileMenuOpen]);

  // Focus first link when mobile menu opens
  useEffect(() => {
    if (isMobileMenuOpen) {
      const firstLink = document.querySelector(
        "#primary-nav a"
      ) as HTMLAnchorElement;
      firstLink?.focus();
    }
  }, [isMobileMenuOpen]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about-me", label: "About Me" },
    { href: "/education", label: "Education" },
    { href: "/experience", label: "Experience" },
    { href: "/projects", label: "Projects" },
    { href: "/contact", label: "Contact" },
  ];

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 bg-white/75 dark:bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-neutral-200 dark:border-neutral-800 transition-all duration-300 ${
        isScrolled ? "h-12" : "h-16"
      }`}
    >
      <div className="mx-auto max-w-screen-lg px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Avatar */}
        <Link href="/" aria-label="Home">
          <Image
            src="/avatar.svg"
            alt="Abhaysai Vemula"
            width={48}
            height={48}
            className="rounded-full ring-transparent focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul
            className="flex items-center space-x-8"
            onMouseLeave={() => setHovered(null)}
          >
            {navLinks.map((link, i) => (
              <li
                key={link.href}
                className={`transition-transform duration-200 ${
                  hovered !== null && i < hovered
                    ? "motion-safe:-translate-x-1"
                    : ""
                } ${
                  hovered !== null && i > hovered
                    ? "motion-safe:translate-x-1"
                    : ""
                }`}
              >
                <Link
                  href={link.href}
                  className={`px-3 py-2 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500 ${
                    hovered === i
                      ? "underline underline-offset-4 mx-2 scale-105"
                      : ""
                  } ${
                    isActiveLink(link.href)
                      ? "text-neutral-900 dark:text-neutral-100 opacity-100"
                      : "text-neutral-600 dark:text-neutral-400 opacity-80"
                  }`}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2 rounded-md text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-controls="primary-nav"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span className="sr-only">Toggle navigation menu</span>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Navigation Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-4 pt-2 pb-3 space-y-1 bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800">
            <nav id="primary-nav" aria-label="Primary">
              <ul className="space-y-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        isActiveLink(link.href)
                          ? "text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800"
                          : "text-neutral-600 dark:text-neutral-400"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
