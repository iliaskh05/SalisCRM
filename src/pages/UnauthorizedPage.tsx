import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

export function UnauthorizedPage() {
  const { signOut, profile, role, isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isAuthenticated
            ? profile
              ? `Votre rôle (${role ? ROLE_LABELS[role] : "inconnu"}) n’autorise pas cette page.`
              : "Votre compte n’a pas de profil staff. Demandez à un administrateur de vous ajouter dans staff_profiles."
            : "Vous devez être connecté."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => void signOut()}>
            Se déconnecter
          </Button>
          <Link to="/login">
            <Button variant="accent">Connexion</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
