"use client";

// The product-demo card: app-shell chrome (matching Showcase) wrapping a
// two-pane "raw notes → structured note" view. Stateless and presentational —
// it renders whatever the parent tells it via `typed` (left-pane text) and
// `revealed`/`phase` (right-pane assembly). The animation lives in the parent;
// with phase="final" + revealed it's the static / reduced-motion fallback.

import {
  Vault,
  Wand2,
  FileText,
  Hash,
  Search,
  Image as ImageIcon,
  Sparkles,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoSample } from "./demo-data";

export type DemoPhase = "typing" | "thinking" | "reveal" | "hold" | "final";

// Reveal gating: which output blocks are visible, in real AI-Dump stream order
// (title → tags → tldr → body → actions). Parent drives these during "reveal".
export interface RevealState {
  title: boolean;
  tags: boolean;
  tldr: boolean;
  body: boolean;
  actions: boolean;
}

export const ALL_REVEALED: RevealState = {
  title: true,
  tags: true,
  tldr: true,
  body: true,
  actions: true,
};

export const NONE_REVEALED: RevealState = {
  title: false,
  tags: false,
  tldr: false,
  body: false,
  actions: false,
};

// Render markdown-style **bold** spans without a full markdown parser.
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-white/90">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

const SIDEBAR = [
  { icon: Wand2, label: "AI Dump", active: true },
  { icon: FileText, label: "Notes" },
  { icon: Hash, label: "Tags" },
  { icon: Search, label: "Search" },
  { icon: ImageIcon, label: "Media" },
];

interface DemoCardProps {
  sample: DemoSample;
  /** Text shown in the left (raw) pane — the typewriter feeds this. */
  typed: string;
  /** Whether the typing cursor blinks at the end of `typed`. */
  showCursor?: boolean;
  /** During "thinking", the input pane dims and a scan-line sweeps. */
  dimInput?: boolean;
  scanning?: boolean;
  /** Per-block reveal gating for the right pane. */
  reveal?: RevealState;
  className?: string;
}

export function DemoCard({
  sample,
  typed,
  showCursor = false,
  dimInput = false,
  scanning = false,
  reveal = ALL_REVEALED,
  className,
}: DemoCardProps) {
  const r = sample.result;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#0b1418]/80 text-left shadow-[0_40px_120px_-20px_rgba(79,209,224,0.35)] backdrop-blur-xl",
        className
      )}
    >
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
        <aside className="col-span-3 hidden border-r border-white/10 p-4 lg:block">
          <div className="mb-5 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#4FD1E0] to-[#1E8A99]">
              <Vault className="size-4 text-white" />
            </span>
            <span className="text-sm font-semibold text-white">IntelliVault</span>
          </div>
          {SIDEBAR.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={cn(
                  "mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                  item.active
                    ? "bg-[#4FD1E0]/15 text-white"
                    : "text-white/45"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </div>
            );
          })}
        </aside>

        {/* main: raw → structured */}
        <div className="col-span-12 grid grid-cols-1 lg:col-span-9 lg:grid-cols-2">
          {/* left: raw paste */}
          <div className="relative border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/35">
              <FileText className="size-3.5" />
              Raw paste
            </div>
            <div
              className={cn(
                "min-h-[168px] font-mono text-[13px] leading-relaxed text-white/45 transition-opacity duration-500",
                dimInput && "opacity-30"
              )}
            >
              {typed}
              {showCursor && (
                <span className="ml-0.5 inline-block w-[2px] -translate-y-[1px] animate-[demo-blink_1s_steps(2)_infinite] align-middle text-[#4FD1E0]">
                  ▍
                </span>
              )}
            </div>
            {/* scan-line during "thinking" */}
            {scanning && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#4FD1E0]/30 to-transparent"
                style={{ animation: "demo-scan 0.9s ease-in-out" }}
              />
            )}
          </div>

          {/* right: structured note */}
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[#8AE5EF]">
              <Sparkles className="size-4" />
              AI Dump
              <span
                className={cn(
                  "transition-all duration-500",
                  !reveal.actions && "opacity-0"
                )}
              >
                {" "}· generated just now
              </span>
            </div>

            {/* title */}
            <h3
              className={cn(
                "text-lg font-semibold leading-snug text-white transition-all sm:text-xl",
                !reveal.title && "opacity-0"
              )}
            >
              {r.title}
            </h3>

            {/* tags */}
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-2 transition-all",
                !reveal.tags && "opacity-0"
              )}
            >
              {r.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-[#4FD1E0]/30 bg-[#4FD1E0]/10 px-2.5 py-1 text-xs text-[#C5F2F7]"
                >
                  #{t}
                </span>
              ))}
            </div>

            {/* tldr */}
            <p
              className={cn(
                "mt-4 text-sm leading-relaxed text-white/55 transition-all",
                !reveal.tldr && "opacity-0"
              )}
            >
              {r.tldr}
            </p>

            {/* body sections */}
            <div
              className={cn(
                "mt-5 space-y-4 transition-all",
                !reveal.body && "opacity-0"
              )}
            >
              {r.sections.map((s) => (
                <div key={s.heading}>
                  <div className="mb-1.5 text-sm font-semibold text-white/80">
                    {s.heading}
                  </div>
                  {s.kind === "quote" ? (
                    <p className="border-l-2 border-[#4FD1E0]/40 pl-3 text-sm italic leading-relaxed text-white/50">
                      <RichText text={s.items[0]} />
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {s.items.map((it, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm leading-relaxed text-white/60"
                        >
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-[#4FD1E0]/70" />
                          <span>
                            <RichText text={it} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* action items */}
            <div
              className={cn(
                "mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all",
                !reveal.actions && "opacity-0"
              )}
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
                <span className="grid size-5 place-items-center rounded bg-[#4FD1E0]/20 text-[#C5F2F7]">
                  <ListTodo className="size-3.5" />
                </span>
                Action items
              </div>
              <ul className="space-y-2.5">
                {r.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-[#4FD1E0] bg-[#4FD1E0]/90 text-[10px] font-bold text-[#06141a]">
                      ✓
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug text-white/70">
                      {a.text}
                      {a.assignee && (
                        <span className="rounded border border-white/10 bg-white/5 px-1.5 text-[10px] text-[#8AE5EF]">
                          @{a.assignee}
                        </span>
                      )}
                      {a.due && (
                        <span className="rounded border border-white/10 bg-white/5 px-1.5 text-[10px] text-white/50">
                          Due {a.due}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
