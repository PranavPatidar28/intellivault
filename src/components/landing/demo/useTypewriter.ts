"use client";

// raf typewriter for the demo's raw-input pane. Types `text` character by
// character with human-feeling jitter while `run` is true; resets whenever
// `resetKey` changes (new loop / new sample). Returns the substring shown so
// far. The parent jumps straight to full text under reduced motion by simply
// not running it and rendering `text` directly.

import { useEffect, useRef, useState } from "react";

export function useTypewriter(
  text: string,
  run: boolean,
  resetKey: unknown,
  onDone?: () => void
) {
  const [shown, setShown] = useState("");
  const indexRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Reset when the loop restarts or the sample changes.
  useEffect(() => {
    indexRef.current = 0;
    setShown("");
  }, [resetKey, text]);

  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const tick = (now: number) => {
      acc += now - last;
      last = now;
      // ~22ms/char average with jitter so it reads as typing, not a progress bar
      const step = 16 + Math.random() * 55;
      if (acc >= step) {
        acc = 0;
        if (indexRef.current < text.length) {
          indexRef.current += 1;
          setShown(text.slice(0, indexRef.current));
        }
      }
      if (indexRef.current < text.length) {
        raf = requestAnimationFrame(tick);
      } else {
        onDoneRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, text, resetKey]);

  return shown;
}
