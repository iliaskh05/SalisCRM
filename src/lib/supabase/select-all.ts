import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase limite silencieusement chaque requête à 1 000 lignes (réglage « Max rows » de
 * l'API) : au-delà, des clients ou des factures disparaîtraient des listes sans aucune
 * erreur. Ce helper lit toutes les lignes par tranches et renvoie la même forme
 * { data, error } qu'une requête Supabase, donc il s'insère sans changer le reste du code.
 *
 * La requête doit avoir un tri TOTAL (ajouter .order("id") en dernier critère) : sans cela,
 * des lignes à égalité peuvent être doublonnées ou sautées d'une tranche à l'autre.
 *
 *   selectAll((from, to) =>
 *     supabase.from("clients").select("*").order("created_at").order("id").range(from, to))
 */
const CHUNK = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

export async function selectAll<T>(
  page: (from: number, to: number) => Page<T>,
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await page(from, from + CHUNK - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < CHUNK) return { data: rows, error: null };
  }
}
