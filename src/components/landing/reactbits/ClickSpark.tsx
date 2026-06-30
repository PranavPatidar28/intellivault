"use client";

// Adapted from reactbits.dev "ClickSpark". Emits a small spark burst at the
// pointer on click, drawn on a full-bleed canvas. Purely decorative.

import { useEffect, useRef } from "react";

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children?: React.ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

export default function ClickSpark({
  sparkColor = "#8AE5EF",
  sparkSize = 9,
  sparkRadius = 18,
  sparkCount = 8,
  duration = 420,
  children,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let resizeTimeout: number;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(resize, 80);
    });
    ro.observe(parent);
    resize();

    const easeOut = (t: number) => t * (2 - t);
    let raf = 0;

    // Only run the rAF loop while there are sparks to animate. A perpetual
    // 60fps clear loop for a purely decorative effect wastes the main thread
    // (and battery) while the section is idle or off-screen.
    const stopLoop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      // Final clear so no half-faded spark lingers on the canvas.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const draw = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;
        const progress = elapsed / duration;
        const eased = easeOut(progress);
        const distance = eased * sparkRadius;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - eased;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      ctx.globalAlpha = 1;

      if (sparksRef.current.length > 0) {
        raf = requestAnimationFrame(draw);
      } else {
        raf = 0;
      }
    };

    const startLoop = () => {
      if (raf) return;
      raf = requestAnimationFrame(draw);
    };

    const onClick = (e: MouseEvent) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const burst: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
        x,
        y,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now,
      }));
      sparksRef.current.push(...burst);
      startLoop();
    };
    parent.addEventListener("click", onClick);

    return () => {
      stopLoop();
      ro.disconnect();
      parent.removeEventListener("click", onClick);
      clearTimeout(resizeTimeout);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[60] h-full w-full select-none"
      />
      {children}
    </>
  );
}
