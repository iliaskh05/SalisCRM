import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export function ChatPlaceholderPage() {
  return (
    <div>
      <PageHeader title="Messages" description="Messagerie interne temps réel : prête à connecter (Supabase Realtime)." />
      <EmptyState title="Aucun canal connecté" description="En mode démonstration, ouvrez l’application avec VITE_DEMO_MODE=true pour la messagerie interactive." />
    </div>
  );
}
