"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
];

// Shared focus-visible ring tuned for the near-black hero: a bright cyan ring
// with a dark offset so keyboard focus is unmistakable on the dark surface.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FD1E0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06080B]";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on Escape for keyboard users.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || menuOpen
          ? "border-b border-white/10 bg-[#0a1216]/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className={cn(
            "group rounded-full",
            FOCUS_RING
          )}
        >
          <Logo
            iconSize={28}
            showText
            textClass="text-[15px] text-white transition-transform group-hover:scale-[1.02] duration-200"
            className="transition-transform group-hover:scale-[1.03] duration-200"
          />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm text-white/60 transition-colors hover:text-white",
                FOCUS_RING
              )}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/signin"
            className={cn(
              "hidden rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex",
              FOCUS_RING
            )}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0d1a1f] shadow-[0_0_20px_rgba(138,229,239,0.35)] transition-all hover:shadow-[0_0_28px_rgba(138,229,239,0.6)] hover:brightness-105",
              FOCUS_RING
            )}
          >
            Get started
          </Link>

          {/* Mobile menu toggle — exposes the section links + Sign in that are
              hidden below md/sm so they stay reachable on phones. */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className={cn(
              "grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden",
              FOCUS_RING
            )}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile disclosure panel. */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="border-t border-white/10 bg-[#0a1216]/95 px-5 py-3 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                  FOCUS_RING
                )}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/signin"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                FOCUS_RING
              )}
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
