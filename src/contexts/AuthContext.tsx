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
  /** Mot de passe validé mais code de double authentification encore attendu */
  needsMfa: boolean;
  /** La direction exige la double authentification des administrateurs et ce compte n'en a pas encore */
  mfaEnrollmentRequired: boolean;
  refreshMfaState: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; mfaRequired?: boolean }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
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

/**
 * Vrai si le compte a activé la double authentification mais que la session n'a pas encore
 * passé le code (niveau aal1 au lieu de aal2). En cas d'erreur on répond "non" : ce n'est
 * qu'un confort d'affichage, la base refuse de toute façon toute donnée à une session aal1
 * d'un compte protégé (fonction mfa_satisfied).
 */
async function fetchNeedsMfa(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    // Jeton illisible : ne jamais bloquer l’écran sur « Chargement… » (la base reste le garde-fou)
    return false;
  }
}

/** Administrateur sans double authentification alors que la direction l'exige. */
async function fetchEnrollmentRequired(role: StaffRole | null): Promise<boolean> {
  if (role !== "admin") return false;
  try {
    const [{ data: policy }, { data: factors }] = await Promise.all([
      supabase.rpc("security_policy"),
      supabase.auth.mfa.listFactors(),
    ]);
    return policy?.require_admin_mfa === true && (factors?.totp?.length ?? 0) === 0;
  } catch {
    return false; // confort d'affichage : la base applique la règle quoi qu'il arrive
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [enrollRequired, setEnrollRequired] = useState(false);

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
        const mfa = await fetchNeedsMfa();
        const enroll = mfa ? false : await fetchEnrollmentRequired(p?.role ?? null);
        if (mounted) {
          setNeedsMfa(mfa);
          setEnrollRequired(enroll);
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setNeedsMfa(false);
        setEnrollRequired(false);
        setLoading(false);
        return;
      }
      // Évite le deadlock potentiel avec Supabase auth callbacks
      void Promise.resolve().then(async () => {
        const p = await fetchStaffProfile(nextSession.user.id);
        const mfa = await fetchNeedsMfa();
        const enroll = mfa ? false : await fetchEnrollmentRequired(p?.role ?? null);
        if (mounted) {
          setProfile(p);
          setNeedsMfa(mfa);
          setEnrollRequired(enroll);
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

    let profileRole: StaffRole | null = null;
    if (data.user) {
      const p = await fetchStaffProfile(data.user.id);
      setProfile(p);
      profileRole = p?.role ?? null;
      if (!p) {
        await supabase.auth.signOut();
        setSession(null);
        return {
          error:
            "Compte authentifié mais non autorisé (aucun profil staff). Contactez la direction.",
        };
      }
    }
    const mfaRequired = await fetchNeedsMfa();
    setNeedsMfa(mfaRequired);
    if (!mfaRequired) setEnrollRequired(await fetchEnrollmentRequired(profileRole));
    return { error: null, mfaRequired };
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) return { error: listError.message };
    const factor = factors?.totp?.[0];
    if (!factor) return { error: "Aucun appareil d’authentification n’est enregistré pour ce compte." };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (error) return { error: "Code incorrect ou expiré. Vérifiez l’heure de votre téléphone et réessayez." };
    setNeedsMfa(await fetchNeedsMfa());
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setNeedsMfa(false);
    setEnrollRequired(false);
  }, []);

  const refreshMfaState = useCallback(async () => {
    const mfa = await fetchNeedsMfa();
    setNeedsMfa(mfa);
    setEnrollRequired(mfa ? false : await fetchEnrollmentRequired(profile?.role ?? null));
  }, [profile?.role]);

  const role = profile?.role ?? null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      loading,
      needsMfa,
      mfaEnrollmentRequired: enrollRequired,
      refreshMfaState,
      // Tant que le code n'est pas saisi, la session ne donne accès à rien
      isAuthenticated: Boolean(session?.user) && !needsMfa,
      isStaff: Boolean(profile),
      signIn,
      verifyMfa,
      signOut,
      refreshProfile,
      hasPermission: (permission) => can(role, permission),
    }),
    [session, profile, role, loading, needsMfa, enrollRequired, refreshMfaState, signIn, verifyMfa, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
