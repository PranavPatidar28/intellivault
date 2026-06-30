"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fire-and-forget database warm-up.
 *
 * Mounted once in the root layout, but it only pings the DB health endpoint on
 * routes where the visitor is about to (or already does) need the database:
 * the auth pages and any authenticated app route. This pre-empts a Neon
 * serverless cold start without waking the database for anonymous marketing
 * visitors who land on the public homepage and bounce. Renders nothing and
 * never blocks the UI — failures are swallowed because the server-side retry
 * policy is the real safety net.
 */
export function DbWarmup() {
  const pathname = usePathname();

  // Warm up on the auth flow and inside the app shell, but not on the public
  // landing/marketing pages where most visitors never sign in.
  const shouldWarm =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/tags") ||
    pathname.startsWith("/media") ||
    pathname.startsWith("/aidump") ||
    pathname.startsWith("/settings");

  useEffect(() => {
    if (!shouldWarm) return;

    const controller = new AbortController();

    fetch("/api/health/db", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // Ignore: the warm-up is best-effort. Cold-start resilience for real
      // requests is handled server-side by the Prisma retry wrapper.
    });

    return () => controller.abort();
  }, [shouldWarm]);

  return null;
}
