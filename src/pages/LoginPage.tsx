import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema } from "@/lib/validations";
import { supabase } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { signIn, verifyMfa, signOut, session, needsMfa, isAuthenticated, isStaff, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");

  if (!loading && isAuthenticated && isStaff) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setSubmitting(true);
    const result = await signIn(parsed.data.email, parsed.data.password);
    const { error } = result;
    setSubmitting(false);

    if (error) {
      toast.error("Connexion impossible", { description: error });
      return;
    }
    if (!result.mfaRequired) toast.success("Bienvenue sur SalisCRM");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error("Saisissez le code à 6 chiffres de votre application d’authentification.");
      return;
    }
    setSubmitting(true);
    const { error } = await verifyMfa(code);
    setSubmitting(false);
    if (error) {
      toast.error("Vérification impossible", { description: error });
      setCode("");
      return;
    }
    toast.success("Bienvenue sur SalisCRM");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.02_205),_var(--background)_55%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[0_20px_50px_-28px_oklch(0.2_0.03_250/0.45)]">
        <div className="mb-8">
          <BrandLogo size="xl" align="center" />
          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-ink">SalisCRM</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Espace interne — direction, commerciaux et prestataires
          </p>
        </div>

        {session && needsMfa ? (
          <form onSubmit={onVerify} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              Double authentification : saisissez le code à 6 chiffres affiché par votre application
              d’authentification.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Code de vérification</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Vérification…" : "Valider"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => void signOut()}
            >
              Annuler et changer de compte
            </button>
          </form>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@salis3hottes.fr"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        )}
        <div className="mt-5 flex flex-col gap-2 text-sm">
          <button
            type="button"
            className="text-left text-xs text-muted-foreground hover:underline"
            onClick={async () => {
              if (!email) {
                toast.error("Saisissez votre email");
                return;
              }
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/definir-mot-de-passe`,
              });
              if (error) toast.error(error.message);
              else toast.success("Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.");
            }}
          >
            Mot de passe oublié
          </button>
          <p className="text-xs text-muted-foreground">Pas encore d’accès ? Demandez une invitation à la direction.</p>
        </div>
      </div>
    </div>
  );
}
