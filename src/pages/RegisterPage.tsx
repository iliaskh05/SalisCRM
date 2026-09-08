import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Select } from "@/components/ui/select";

export function RegisterPage() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kind, setKind] = useState("prestataire");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!loading && isAuthenticated && isStaff) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, requested_role: kind } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <BrandLogo size="lg" align="center" />
        <h1 className="mt-5 text-2xl font-semibold">Demande d’accès</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L’inscription ne donne jamais de droits administrateur. Statut : inscrit → en attente → approuvé par la direction.
        </p>
        {done ? (
          <p className="mt-6 rounded-lg bg-teal-50 p-4 text-sm text-teal-900">
            Demande envoyée. La direction doit créer votre profil staff avant connexion.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
            <div>
              <Label>Type demandé</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="prestataire">Prestataire</option>
                <option value="commercial">Direction / gestion</option>
              </Select>
            </div>
            <Button type="submit" variant="accent" className="w-full" disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm text-teal-700">Retour à la connexion</Link>
      </div>
    </div>
  );
}
