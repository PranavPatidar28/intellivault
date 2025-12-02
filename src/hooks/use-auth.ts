import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();
  
  return {
    user: session?.user,
    session,
    isLoading: isPending,
    isAuthenticated: !!session,
    error,
  };
}