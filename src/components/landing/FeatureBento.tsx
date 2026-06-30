"use client";

import { FEATURES } from "./features";
import SpotlightCard from "./reactbits/SpotlightCard";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

export function FeatureBento() {
  return (
    <section id="features" className="relative px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] rb-spectral-text">
            Everything in one vault
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Capture anything. Find everything.
          </h2>
          <p className="mt-5 text-balance text-lg text-white/60">
            A focused set of tools that work together — from AI-powered capture
            to search that actually understands what you meant.
          </p>
        </Reveal>

        <div className="grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal
                key={f.title}
                className={cn("min-h-[220px]", f.className)}
                delay={i * 0.05}
              >
                <SpotlightCard
                  className="group h-full"
                  spotlightColor="rgba(79, 209, 224, 0.22)"
                >
                  <div
                    className={cn(
                      "flex h-full flex-col p-7",
                      f.large && "sm:p-9"
                    )}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span
                        className={cn(
                          "grid place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] text-[#C5F2F7] shadow-inner",
                          f.large ? "size-14" : "size-11"
                        )}
                      >
                        <Icon className={f.large ? "size-7" : "size-5"} />
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/50">
                        {f.tag}
                      </span>
                    </div>

                    <h3
                      className={cn(
                        "font-semibold tracking-tight text-white",
                        f.large ? "text-2xl sm:text-3xl" : "text-xl"
                      )}
                    >
                      {f.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-3 leading-relaxed text-white/55",
                        f.large ? "max-w-md text-base" : "text-sm"
                      )}
                    >
                      {f.description}
                    </p>

                    {f.large && (
                      <div className="mt-auto pt-8">
                        <div className="flex flex-wrap gap-2">
                          {["Auto title", "Smart tags", "Action items", "Headings"].map(
                            (chip) => (
                              <span
                                key={chip}
                                className="rounded-lg border border-[#4FD1E0]/30 bg-[#4FD1E0]/10 px-3 py-1.5 text-xs font-medium text-[#C5F2F7]"
                              >
                                {chip}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
