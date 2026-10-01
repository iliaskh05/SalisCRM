import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { newPasswordSchema } from "@/lib/validations";
import { supabase } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cible des liens d'invitation et de réinitialisation envoyés par Supabase Auth. */
export function SetPasswordPage() {
  const { session, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Mot de passe invalide");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) {
      toast.error("Mot de passe non enregistré", { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success("Mot de passe enregistré");
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <BrandLogo size="lg" align="center" />
        <h1 className="mt-5 text-xl font-semibold">Choisir votre mot de passe</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Vérification du lien…</p>
        ) : !session ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Ce lien est invalide ou a expiré. Demandez une nouvelle invitation à la direction, ou utilisez
              « Mot de passe oublié » sur la page de connexion.
            </p>
            <Link to="/login" className="text-teal-700">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <p className="text-sm text-muted-foreground">
              Compte : <b>{session.user.email}</b>. 10 caractères minimum, avec majuscule, minuscule et chiffre.
            </p>
            <div>
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirmation</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="accent" className="w-full" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
