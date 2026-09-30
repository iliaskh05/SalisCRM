import { Button } from "@/components/ui/button";

/** Écran affiché si l'interface plante, au lieu d'une page blanche. */
export function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L’équipe technique a été prévenue. Vos données enregistrées ne sont pas affectées.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={resetError}>
            Réessayer
          </Button>
          <Button variant="accent" onClick={() => window.location.assign("/")}>
            Retour à l’accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
