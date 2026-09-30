import { isDemoMode } from "@/lib/demo/mode";
import type { Json } from "@/lib/supabase/types";

export type LeadPhoto = {
  path: string;
  url?: string;
  name: string;
  kind: "before" | "technical" | "after";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function kindFrom(value: unknown): LeadPhoto["kind"] {
  if (value === "after" || value === "technical" || value === "before") return value;
  return "before";
}

export function parseLeadPhotos(photos: Json | LeadPhoto[] | null | undefined): LeadPhoto[] {
  if (!photos) return [];
  if (!Array.isArray(photos)) {
    const rec = asRecord(photos);
    if (rec?.url || rec?.path || rec?.storage_path) {
      return parseLeadPhotos([photos as Json]);
    }
    return [];
  }

  return photos.flatMap((item, index): LeadPhoto[] => {
    if (typeof item === "string") {
      const path = item.trim();
      if (!path) return [];
      return [
        {
          path,
          url: path.startsWith("http") || path.startsWith("data:") ? path : undefined,
          name: path.split("/").pop() ?? `Photo ${index + 1}`,
          kind: "before",
        },
      ];
    }
    const rec = asRecord(item);
    if (!rec) return [];
    const path = String(rec.path ?? rec.storage_path ?? rec.url ?? "").trim();
    if (!path) return [];
    const url = typeof rec.url === "string" ? rec.url : path.startsWith("http") || path.startsWith("data:") ? path : undefined;
    return [
      {
        path,
        url,
        name: String(rec.name ?? path.split("/").pop() ?? `Photo ${index + 1}`),
        kind: kindFrom(rec.kind),
      },
    ];
  });
}

/**
 * Les leads viennent d’un formulaire public : on n’affiche que les images servies par
 * notre projet Supabase (pas de pixel de suivi externe, pas de data:/javascript:).
 */
export function isTrustedPhotoUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (isDemoMode()) return true;
  try {
    const origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}
