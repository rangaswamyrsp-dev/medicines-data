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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (s: Session | null) => {
      if (!s) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      // Creates the profile on first login and assigns a role (first user = admin).
      const { data: r } = await supabase.rpc("ensure_profile");
      const { data: p } = await supabase.from("profiles").select("id, name, email").eq("id", s.user.id).maybeSingle();
      if (!active) return;
      setRole((r as AppRole) ?? "user");
      setProfile(p ?? null);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(s);
      // Defer backend calls out of the auth callback.
      setTimeout(() => loadProfile(s), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, role, isAdmin: role === "admin", loading, signOut }}
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
