import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabase/client";
import { PHOTO_KIND_LABELS, STORAGE_BUCKETS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";


export function PhotosTab({
  photos,
  canDelete,
  onChanged,
}: {
  photos: Tables<"intervention_photos">[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Tables<"intervention_photos"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage
          .from(STORAGE_BUCKETS.interventionPhotos)
          .createSignedUrl(p.storage_path, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const remove = useMutation({
    mutationFn: async (photo: Tables<"intervention_photos">) => {
      // Ligne d’abord : si la suppression est refusée, le fichier reste consultable
      const { error } = await supabase.from("intervention_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from(STORAGE_BUCKETS.interventionPhotos).remove([photo.storage_path]);
    },
    onSuccess: () => {
      toast.success("Photo supprimée");
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (photos.length === 0) return <EmptyState title="Aucune photo" />;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            {urls[p.id] ? (
              <img src={urls[p.id]} alt={p.comment ?? p.kind} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">
                Chargement…
              </div>
            )}
            <CardContent className="space-y-2 p-3">
              <p className="text-sm font-medium">{PHOTO_KIND_LABELS[p.kind]}</p>
              <p className="text-xs text-muted-foreground">{p.comment || formatDateTime(p.created_at)}</p>
              {canDelete ? (
                <Button size="sm" variant="outline" onClick={() => setToDelete(p)}>
                  Supprimer
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer cette photo ?"
        description="Action irréversible (admin uniquement)."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </>
  );
}
