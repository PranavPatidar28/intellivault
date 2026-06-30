"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import StarBorder from "./reactbits/StarBorder";
import ClickSpark from "./reactbits/ClickSpark";

export function FinalCTA() {
  return (
    <section className="relative px-5 py-32 sm:px-8">
      <Reveal y={40}>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 px-6 py-20 text-center sm:px-16">
          <ClickSpark sparkColor="#C5F2F7" sparkCount={10} sparkRadius={22}>
            {/* glow backdrop */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(80% 120% at 50% 0%, rgba(79,209,224,0.35), transparent 60%), linear-gradient(180deg, rgba(10,18,22,0.9), rgba(7,11,15,0.95))",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(138,229,239,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(138,229,239,0.2) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
                maskImage:
                  "radial-gradient(60% 60% at 50% 40%, black, transparent)",
              }}
            />

            <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Give your ideas a home that thinks
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-white/65">
              Start capturing smarter today. Your vault is free to set up and
              ready in seconds.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <StarBorder as={Link} href="/signup" speed="5s" color="#C5F2F7">
                <span className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white">
                  Create your vault
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </StarBorder>
              <Link
                href="/signin"
                className="inline-flex items-center rounded-full px-6 py-3.5 text-base font-medium text-white/70 transition-colors hover:text-white"
              >
                I already have an account
              </Link>
            </div>
          </ClickSpark>
        </div>
      </Reveal>
    </section>
  );
}
