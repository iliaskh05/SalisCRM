import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <BrandLogo size="lg" align="center" />
        <p className="mt-6 text-sm font-semibold text-accent">Erreur 404</p>
        <h1 className="mt-1 text-xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">L’adresse saisie n’existe pas ou a été déplacée.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
