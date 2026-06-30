"use client";

import { Wand2, FileText, Hash, Search, Image as ImageIcon, Vault, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

// A stylized representation of the app shell. This is an illustrative mock,
// not a screenshot — swap for a real product capture when available.
export function Showcase() {
  return (
    <section id="showcase" className="relative px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] rb-spectral-text">
            A calm place to think
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Designed to get out of your way
          </h2>
        </Reveal>

        <Reveal y={40}>
          <div className="relative mx-auto max-w-5xl">
            {/* glow */}
            <div
              aria-hidden
              className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[2rem] opacity-60 blur-3xl"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 0%, rgba(79,209,224,0.35), transparent 70%)",
              }}
            />
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1418]/80 shadow-[0_40px_120px_-20px_rgba(79,209,224,0.5)] backdrop-blur-xl">
              {/* window chrome */}
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="size-3 rounded-full bg-white/15" />
                <span className="size-3 rounded-full bg-white/15" />
                <span className="size-3 rounded-full bg-white/15" />
                <div className="ml-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-xs text-white/40">
                  <Vault className="size-3.5 text-[#8AE5EF]" />
                  intellivault.app
                </div>
              </div>

              <div className="grid grid-cols-12">
                {/* sidebar */}
                <aside className="col-span-3 hidden border-r border-white/10 p-4 sm:block">
                  <div className="mb-5 flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#4FD1E0] to-[#1E8A99]">
                      <Vault className="size-4 text-white" />
                    </span>
                    <span className="text-sm font-semibold text-white">IntelliVault</span>
                  </div>
                  {[
                    { icon: Wand2, label: "AI Dump", active: true },
                    { icon: FileText, label: "Notes" },
                    { icon: Hash, label: "Tags" },
                    { icon: Search, label: "Search" },
                    { icon: ImageIcon, label: "Media" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                          item.active
                            ? "bg-[#4FD1E0]/15 text-white"
                            : "text-white/45"
                        }`}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </div>
                    );
                  })}
                </aside>

                {/* main */}
                <div className="col-span-12 p-6 sm:col-span-9 sm:p-8">
                  <div className="mb-6 flex items-center gap-2 text-xs font-medium text-[#8AE5EF]">
                    <Sparkles className="size-4" />
                    AI Dump · generated just now
                  </div>

                  <div className="h-7 w-2/3 rounded-md bg-gradient-to-r from-white/25 to-white/5" />

                  <div className="mt-5 flex flex-wrap gap-2">
                    {["#research", "#q3-planning", "#product", "#priority"].map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-[#4FD1E0]/30 bg-[#4FD1E0]/10 px-2.5 py-1 text-xs text-[#C5F2F7]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="h-3 w-full rounded bg-white/10" />
                    <div className="h-3 w-[92%] rounded bg-white/[0.07]" />
                    <div className="h-3 w-[85%] rounded bg-white/[0.07]" />
                  </div>

                  <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
                      <span className="grid size-5 place-items-center rounded bg-[#4FD1E0]/20 text-[#C5F2F7]">
                        ✓
                      </span>
                      Action items
                    </div>
                    {[true, false, false].map((checked, i) => (
                      <div key={i} className="mb-2 flex items-center gap-3">
                        <span
                          className={`size-4 rounded border ${
                            checked
                              ? "border-[#4FD1E0] bg-[#4FD1E0]"
                              : "border-white/20"
                          }`}
                        />
                        <span
                          className={`h-2.5 rounded ${
                            checked ? "w-1/3 bg-white/20" : "w-1/2 bg-white/[0.08]"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
