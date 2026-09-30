import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { isTrustedPhotoUrl, parseLeadPhotos, type LeadPhoto } from "@/lib/quote-requests/photos";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

export function RequestPhotos({ photos }: { photos: Json | LeadPhoto[] | null | undefined }) {
  // URL externes écartées : on retombe sur le chemin Storage (URL signée) quand il existe
  const items = parseLeadPhotos(photos).map((p) => (isTrustedPhotoUrl(p.url) ? p : { ...p, url: undefined }));
  const [active, setActive] = useState<LeadPhoto | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune photo transmise avec cette demande.</p>;
  }

  async function open(photo: LeadPhoto) {
    if (photo.url) {
      setActive({ ...photo, url: photo.url });
      return;
    }
    if (signed[photo.path]) {
      setActive({ ...photo, url: signed[photo.path] });
      return;
    }
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.leadDocuments).createSignedUrl(photo.path, 3600);
    const url = data?.signedUrl;
    if (!url) {
      setActive({ ...photo, url: undefined });
      return;
    }
    setSigned((prev) => ({ ...prev, [photo.path]: url }));
    setActive({ ...photo, url });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((photo) => (
          <button
            key={photo.path}
            type="button"
            className="group overflow-hidden rounded-xl border border-border bg-muted text-left"
            onClick={() => void open(photo)}
          >
            <img
              src={photo.url ?? signed[photo.path] ?? ""}
              alt={photo.name}
              className="aspect-[4/3] w-full bg-slate-200 object-cover transition group-hover:opacity-90"
            />
            <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{photo.name}</p>
          </button>
        ))}
      </div>
      <Dialog open={Boolean(active)} onClose={() => setActive(null)} title={active?.name ?? "Photo"} wide>
        {active?.url ? (
          <img src={active.url} alt={active.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">Aperçu indisponible (fichier privé, URL signée manquante).</p>
        )}
      </Dialog>
    </>
  );
}
