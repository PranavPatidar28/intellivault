"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { PrismBackground } from "./PrismBackground";
import ShinyText from "./reactbits/ShinyText";
import StarBorder from "./reactbits/StarBorder";
import { HeroDemo } from "./demo/HeroDemo";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
      <PrismBackground />

      {/* fine grid texture — whispered, so it reads as a surface the prism's
          light falls across rather than a competing pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(138,229,239,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(138,229,239,0.14) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <a
          href="#features"
          className="group mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur-sm transition-colors hover:border-white/25"
        >
          <Sparkles className="size-3.5 text-[#4FD1E0]" />
          <ShinyText
            text="AI that turns chaos into organized notes"
            speed={6}
            className="text-[13px] font-medium"
          />
        </a>

        {/* Display serif accent on "second brain" — editorial, considered,
            archival; the rest stays in tight-tracked Geist. */}
        <h1 className="text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
          <span>
            Your{" "}
            <span className="font-serif font-normal italic tracking-[-0.01em] text-white/95">
              second brain
            </span>
            ,{" "}
          </span>
          <span className="text-white/85">intelligently organized.</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-white/60 sm:text-lg">
          Drop in messy notes, PDFs or a wall of text. Watch IntelliVault turn it
          into a clean, structured note — titled, tagged and ready to find.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <StarBorder as={Link} href="/signup" speed="5s" color="#4FD1E0">
            <span className="group inline-flex items-center gap-2 px-7 py-3 text-[15px] font-semibold text-white">
              Start for free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </StarBorder>

          <Link
            href="/signin"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-white/75 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </div>

        {/* The product, live — messy paste → structured note. */}
        <div className="mt-14 w-full">
          <HeroDemo />
        </div>

        <p className="mt-8 text-sm text-white/40">
          No credit card required · Built on Next.js, better-auth &amp; vector
          search
        </p>
      </div>
    </section>
  );
}
