"use client";

// Hero product-demo island — the autoplay loop.
//
// Phase machine: typing → thinking → reveal → hold → (loop). Typing is
// event-driven (ends when the typewriter finishes); the rest are timed. The
// whole machine is gated on visibility + reduced-motion + a user play toggle,
// so it costs nothing offscreen and degrades to a static finished card.

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { SAMPLES, DEFAULT_SAMPLE_ID } from "./demo-data";
import {
  DemoCard,
  ALL_REVEALED,
  NONE_REVEALED,
  type RevealState,
} from "./DemoCard";
import { useTypewriter } from "./useTypewriter";

type Phase = "typing" | "thinking" | "reveal" | "hold";

const THINKING_MS = 1300;
const HOLD_MS = 3800;
// Reveal cascade offsets (ms from start of "reveal"), in real AI-Dump stream
// order: title → tags → tldr → body → actions.
const REVEAL_STEPS: { key: keyof RevealState; at: number }[] = [
  { key: "title", at: 80 },
  { key: "tags", at: 360 },
  { key: "tldr", at: 680 },
  { key: "body", at: 1000 },
  { key: "actions", at: 1500 },
];
const REVEAL_TOTAL = 2100;

export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();

  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];

  const [userPlaying, setUserPlaying] = useState(true);
  const [phase, setPhase] = useState<Phase>("typing");
  const [reveal, setReveal] = useState<RevealState>(NONE_REVEALED);
  // Bumped each loop / sample change to reset the typewriter and re-key motion.
  const [loopId, setLoopId] = useState(0);

  const animate = inView && userPlaying && !reduce;

  // ---- typing phase (event-driven) -------------------------------------
  const onTyped = useCallback(() => {
    setPhase((p) => (p === "typing" ? "thinking" : p));
  }, []);
  const typed = useTypewriter(
    sample.raw,
    animate && phase === "typing",
    loopId,
    onTyped
  );

  // ---- timed phases ----------------------------------------------------
  useEffect(() => {
    if (!animate) return;
    if (phase === "thinking") {
      const t = setTimeout(() => {
        setReveal(NONE_REVEALED);
        setPhase("reveal");
      }, THINKING_MS);
      return () => clearTimeout(t);
    }
    if (phase === "reveal") {
      const timers = REVEAL_STEPS.map((s) =>
        setTimeout(
          () => setReveal((r) => ({ ...r, [s.key]: true })),
          s.at
        )
      );
      const done = setTimeout(() => setPhase("hold"), REVEAL_TOTAL);
      return () => {
        timers.forEach(clearTimeout);
        clearTimeout(done);
      };
    }
    if (phase === "hold") {
      const t = setTimeout(() => {
        setLoopId((n) => n + 1);
        setReveal(NONE_REVEALED);
        setPhase("typing");
      }, HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [phase, animate]);

  // When animation is disabled (offscreen / reduced-motion / paused), show the
  // finished card so the value prop always lands.
  const showFinal = !animate;
  const effectiveReveal = showFinal ? ALL_REVEALED : reveal;
  const effectiveTyped = showFinal ? sample.raw : typed;

  function selectSample(id: string) {
    setSampleId(id);
    setReveal(NONE_REVEALED);
    setPhase("typing");
    setLoopId((n) => n + 1);
    setUserPlaying(true);
  }

  function replay() {
    setReveal(NONE_REVEALED);
    setPhase("typing");
    setLoopId((n) => n + 1);
    setUserPlaying(true);
  }

  return (
    <div ref={ref} className="mx-auto w-full max-w-5xl">
      <DemoCard
        sample={sample}
        typed={effectiveTyped}
        showCursor={animate && phase === "typing"}
        dimInput={animate && (phase === "thinking" || phase === "reveal")}
        scanning={animate && phase === "thinking"}
        reveal={effectiveReveal}
      />

      {/* controls: preset chips + replay/pause */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-white/35">
          Try
        </span>
        {SAMPLES.map((s) => {
          const active = s.id === sampleId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSample(s.id)}
              aria-pressed={active}
              className={
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors " +
                (active
                  ? "border-[#4FD1E0]/50 bg-[#4FD1E0]/10 text-[#C5F2F7]"
                  : "border-white/15 bg-white/5 text-white/65 hover:border-[#4FD1E0]/40 hover:text-white")
              }
            >
              {s.label}
            </button>
          );
        })}

        <span className="mx-1 h-4 w-px bg-white/10" />

        {!reduce && (
          <button
            type="button"
            onClick={() => setUserPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/65 transition-colors hover:border-white/25 hover:text-white"
          >
            {userPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {userPlaying ? "Pause" : "Play"}
          </button>
        )}
        <button
          type="button"
          onClick={replay}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/65 transition-colors hover:border-white/25 hover:text-white"
        >
          <RotateCcw className="size-3.5" />
          Replay
        </button>
      </div>

      {/* text equivalent for assistive tech */}
      <p className="sr-only">
        Demonstration: pasting messy notes into IntelliVault turns them into a
        structured note with a title, tags, a summary, headings and action
        items.
      </p>
    </div>
  );
}
