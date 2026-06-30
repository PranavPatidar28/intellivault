"use client";

// Adapted from reactbits.dev "BlurText" (motion). Per-word blur+rise reveal.
// Respects prefers-reduced-motion by rendering the final state immediately.

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  as?: keyof React.JSX.IntrinsicElements;
}

export default function BlurText({
  text = "",
  delay = 120,
  className = "",
  animateBy = "words",
  direction = "top",
  as: Tag = "p",
}: BlurTextProps) {
  const segments = animateBy === "words" ? text.split(" ") : text.split("");
  const reduce = useReducedMotion();

  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fromY = direction === "top" ? -28 : 28;

  const MotionTag = motion[Tag as "p"] as typeof motion.p;

  if (reduce) {
    const Static = Tag as "p";
    return <Static className={className}>{text}</Static>;
  }

  return (
    <MotionTag ref={ref as React.Ref<HTMLParagraphElement>} className={className}>
      {segments.map((seg, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-[transform,filter,opacity]"
          initial={{ opacity: 0, filter: "blur(10px)", y: fromY }}
          animate={
            inView
              ? { opacity: 1, filter: "blur(0px)", y: 0 }
              : { opacity: 0, filter: "blur(10px)", y: fromY }
          }
          transition={{
            duration: 0.6,
            ease: [0.25, 0.4, 0.25, 1],
            delay: (i * delay) / 1000,
          }}
        >
          {seg === " " ? " " : seg}
          {animateBy === "words" && i < segments.length - 1 ? " " : null}
        </motion.span>
      ))}
    </MotionTag>
  );
}
