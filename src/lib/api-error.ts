import { NextResponse } from "next/server";

/**
 * Build a JSON error response that never leaks internal error details to
 * clients in production. The full error should already be logged server-side
 * by the caller; this only controls what the client sees.
 *
 * In non-production environments the raw message is included under `details`
 * to aid debugging.
 */
export function errorResponse(
  message: string,
  status: number,
  error?: unknown
): NextResponse {
  const body: { error: string; details?: string } = { error: message };

  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    body.details = error.message;
  }

  return NextResponse.json(body, { status });
}
