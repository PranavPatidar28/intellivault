import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Type for the session object from Better Auth
// Better Auth returns the session data directly, not nested
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

// Type for guaranteed non-null session (after requireAuth)
export type AuthenticatedSession = NonNullable<Session>;

/**
 * Get the current session from server components
 * Returns null if no session exists
 */
export async function getServerSession(): Promise<Session | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

/**
 * Require authentication - redirects to signin if not authenticated
 * Use this in server components that require a logged-in user
 */
export async function requireAuth(): Promise<AuthenticatedSession> {
  const session = await getServerSession();

  if (!session) {
    redirect("/signin");
  }

  return session;
}
