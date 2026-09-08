import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema } from "@/lib/validations";
import { supabase } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { signIn, isAuthenticated, isStaff, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);

    if (error) {
      toast.error("Connexion impossible", { description: error });
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
            Espace interne — direction & équipe commerciale
          </p>
        </div>

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
        <div className="mt-5 flex flex-col gap-2 text-sm">
          <button
            type="button"
            className="text-left text-xs text-muted-foreground hover:underline"
            onClick={async () => {
              if (!email) {
                toast.error("Saisissez votre email");
                return;
              }
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) toast.error(error.message);
              else toast.success("Si le compte existe, un e-mail de réinitialisation a été préparé (prêt à connecter).");
            }}
          >
            Mot de passe oublié
          </button>
          <Link to="/register" className="text-teal-700">Demander un accès</Link>
        </div>
      </div>
    </div>
  );
}
