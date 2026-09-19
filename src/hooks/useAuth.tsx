import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: { id: string; name: string; email: string } | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const defaultUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "user@inventory.local",
} as unknown as User;

const defaultProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Operator",
  email: "user@inventory.local",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        session: null,
        user: defaultUser,
        profile: defaultProfile,
        role: "admin",
        isAdmin: true,
        loading: false,
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
