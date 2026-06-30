// Single source of truth for auth state.
//
// This used to spin up its own `authClient.useSession()` subscription, which
// duplicated the one already created by AuthProvider — two competing session
// stores with different return shapes. Re-export the provider-backed hook so
// every `useAuth` import resolves to the same context-backed session.
export { useAuth } from "@/components/AuthProvider";
