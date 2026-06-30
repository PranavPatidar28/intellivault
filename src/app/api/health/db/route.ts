/**
 * Database health / warm-up endpoint.
 *
 * GET /api/health/db
 *
 * Issues a trivial `SELECT 1` (with cold-start retry) against the database.
 * The client mounts a tiny component that calls this when a visitor lands on
 * the site, so a suspended Neon serverless instance starts resuming before the
 * user navigates to an authenticated route that needs the DB.
 *
 * Intentionally unauthenticated: it exposes no data, only a liveness signal.
 */

import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/prisma";

// Always run dynamically; never cache the health result.
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await pingDatabase();

  return NextResponse.json(
    { ok, status: ok ? "up" : "down" },
    { status: ok ? 200 : 503 }
  );
}
