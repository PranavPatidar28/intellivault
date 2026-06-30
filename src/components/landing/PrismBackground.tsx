"use client";

// Client-only WebGL Prism, loaded only when motion is allowed AND the device
// can afford it. The prism is treated as a single luminous object floating in
// darkness (not a full-bleed wash): a tight radial mask keeps it contained, and
// a dark vignette + scrims preserve the depth and legibility that make a dark
// hero read as premium. A static gradient fallback covers SSR / reduced-motion
// / no-WebGL / constrained-device cases.
//
// Performance: the fragment shader runs a 100-step ray-march per pixel and the
// rAF loop never settles, so it is expensive on load. We only mount the live
// canvas on wide, fine-pointer, non-data-saver devices, and we defer the mount
// to idle so the shader doesn't compete with hydration / first paint. Phones,
// tablets, touch devices and save-data users get the static glow only.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const Prism = dynamic(() => import("./reactbits/Prism"), { ssr: false });

export function PrismBackground() {
  const reduce = useReducedMotion();
  const [enableLive, setEnableLive] = useState(false);

  useEffect(() => {
    if (reduce) return;

    // Gate the expensive WebGL ray-march to capable, non-constrained devices:
    // a wide viewport, a fine (mouse) pointer, and no data-saver request.
    const wideEnough = window.matchMedia("(min-width: 768px)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const saveData = nav.connection?.saveData === true;

    if (!wideEnough || !finePointer || saveData) return;

    // Defer mount until the browser is idle so the shader doesn't compete with
    // hydration / first paint for the main thread on the on-load hero.
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setEnableLive(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(mount, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(mount, 400);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deep base — the dark canvas the prism's light falls into. */}
      <div aria-hidden className="absolute inset-0 bg-[#05070A]" />

      {/* Static fallback glow — a single soft cyan bloom where the prism sits.
          Always present; the live canvas layers over it when enabled. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(38% 42% at 50% 46%, rgba(79,209,224,0.28) 0%, rgba(31,138,153,0.10) 45%, transparent 72%)",
        }}
      />

      {enableLive && (
        // Contained stage for the prism: centered, sized as an object, and
        // masked to an ellipse so its light fades into the dark surround
        // instead of flooding the whole section. The cyan color-lock lives
        // INSIDE this masked stage, so it tints only the prism (not the hero)
        // and is faded out at the edges by the same mask.
        <div
          className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,black_30%,transparent_78%)]"
        >
          <Prism
            animationType="3drotate"
            timeScale={0.32}
            scale={3.0}
            height={3.4}
            baseWidth={4.8}
            glow={0.9}
            bloom={1.1}
            noise={0}
            hueShift={0}
            colorFrequency={1.0}
            suspendWhenOffscreen
          />
          {/* Color-lock — solid cyan under "color" blend takes the hue and
              keeps the prism's luminance, reliably landing on-brand regardless
              of the shader's raw spectrum. Confined to this masked stage. */}
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-color"
            style={{ background: "#4FD1E0" }}
          />
        </div>
      )}

      {/* Dark vignette — pulls the edges down so the prism reads as a focal
          object with real depth around it. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 75% at 50% 48%, transparent 40%, rgba(5,7,10,0.55) 78%, #05070A 100%)",
        }}
      />

      {/* Center scrim — a soft darken behind the copy so white text holds
          contrast over the prism's brightest core. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 40% at 50% 44%, rgba(5,7,10,0.62) 0%, rgba(5,7,10,0.22) 50%, transparent 78%)",
        }}
      />

      {/* Bottom fade — blends the hero into the page background below. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#06080B]"
      />
    </div>
  );
}
