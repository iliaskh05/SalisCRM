import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { StaffRole, Tables } from "@/lib/supabase/types";
import { can, type Permission } from "@/lib/auth/permissions";

type StaffProfile = Tables<"staff_profiles">;

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: StaffProfile | null;
  role: StaffRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchStaffProfile(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id, role, display_name, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] staff_profiles", error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    if (!current?.user) {
      setProfile(null);
      return;
    }
    const next = await fetchStaffProfile(current.user.id);
    setProfile(next);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const p = await fetchStaffProfile(data.session.user.id);
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Évite le deadlock potentiel avec Supabase auth callbacks
      void Promise.resolve().then(async () => {
        const p = await fetchStaffProfile(nextSession.user.id);
        if (mounted) {
          setProfile(p);
          setLoading(false);
        }
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      const p = await fetchStaffProfile(data.user.id);
      setProfile(p);
      if (!p) {
        await supabase.auth.signOut();
        setSession(null);
        return {
          error:
            "Compte authentifié mais non autorisé (aucun profil staff). Contactez la direction.",
        };
      }
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const role = profile?.role ?? null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      loading,
      isAuthenticated: Boolean(session?.user),
      isStaff: Boolean(profile),
      signIn,
      signOut,
      refreshProfile,
      hasPermission: (permission) => can(role, permission),
    }),
    [session, profile, role, loading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
