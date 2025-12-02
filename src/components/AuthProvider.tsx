"use client";

import { authClient } from "@/lib/auth-client";
import { createContext, useContext, ReactNode } from "react";

type Session = typeof authClient.$Infer.Session;

interface AuthContextType {
  data: Session | null;
  isPending: boolean;
  error: unknown;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = authClient.useSession();

  return (
    <AuthContext.Provider value={{ data, isPending, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}