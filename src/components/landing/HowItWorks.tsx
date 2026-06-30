"use client";

import { Upload, Wand2, ListTodo, ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    icon: Upload,
    step: "01",
    title: "Drop it in",
    description:
      "Upload PDFs, Word docs, images or paste raw text. Meeting notes, research, a brain dump — whatever you've got.",
  },
  {
    icon: Wand2,
    step: "02",
    title: "AI structures it",
    description:
      "IntelliVault reads it and generates a clean title, smart tags, clear headings and an action-item list — tuned to the kind of content it is.",
  },
  {
    icon: ListTodo,
    step: "03",
    title: "Save & rediscover",
    description:
      "Keep it in your vault, organized by tags and findable by meaning through semantic search whenever you need it again.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative px-5 py-28 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[400px] w-[600px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(79,209,224,0.4), transparent 70%)" }}
      />
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] rb-spectral-text">
            How it works
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            From raw mess to polished note in seconds
          </h2>
        </Reveal>

        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* connecting line on desktop — a faint cyan beam, echoing the hero prism */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-[52px] hidden h-px md:block"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(79,209,224,0.45) 22%, rgba(138,229,239,0.6) 50%, rgba(138,229,239,0.45) 78%, transparent)",
            }}
          />
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.step} delay={i * 0.12} className="relative">
                <div className="flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.02] p-7 backdrop-blur-sm">
                  <div className="mb-6 flex w-full items-center justify-between">
                    <span className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#4FD1E0] to-[#1E8A99] text-white shadow-[0_0_30px_rgba(79,209,224,0.45)]">
                      <Icon className="size-6" />
                    </span>
                    <span className="font-mono text-5xl font-bold text-white/[0.08]">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-white">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                    {s.description}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute -right-5 top-1/2 hidden size-6 -translate-y-1/2 text-[#4FD1E0]/60 md:block"
                  />
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
