"use client";

// Thin client wrapper that loads the WebGL Aurora only on the client and only
// when motion is allowed. A static CSS gradient sits underneath as the fallback
// for SSR, reduced-motion users and devices without WebGL.

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";

const Aurora = dynamic(() => import("./reactbits/Aurora"), { ssr: false });

export function AuroraBackground() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Static fallback gradient — always present, sits behind the canvas. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[70vh] opacity-70"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, rgba(79,209,224,0.45) 0%, rgba(79,209,224,0.12) 35%, transparent 70%)",
        }}
      />
      {!reduce && (
        <div className="absolute inset-x-0 top-0 h-[80vh] opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <Aurora
            colorStops={["#1E8A99", "#4FD1E0", "#8AE5EF"]}
            amplitude={1.1}
            blend={0.55}
            speed={0.8}
          />
        </div>
      )}
    </div>
  );
}
