import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import type { Database, StaffRole, Tables } from "@/lib/supabase/types";

type Intervention = Tables<"interventions">;
type ProviderRow = Database["public"]["Views"]["provider_interventions"]["Row"];
type Result<T> = { data: T | null; error: PostgrestError | null };

/**
 * Un prestataire n'a plus accès à la table interventions (elle contient le prix HT) :
 * il lit la vue provider_interventions, qui ne renvoie que ses interventions et aucune
 * donnée financière. On complète les champs absents pour garder la forme habituelle.
 */
function fromProviderView(row: ProviderRow): Intervention {
  return { ...row, price_ht: null, quote_id: null, created_by: null };
}

export async function fetchInterventions(
  role: StaffRole | null,
  order: { ascending: boolean },
): Promise<Result<Intervention[]>> {
  if (role === "prestataire") {
    const { data, error } = await selectAll((from, to) =>
      supabase
        .from("provider_interventions")
        .select("*")
        .order("scheduled_date", { ascending: order.ascending })
        .order("id")
        .range(from, to),
    );
    return { data: data ? data.map(fromProviderView) : null, error };
  }
  return selectAll((from, to) =>
    supabase
      .from("interventions")
      .select("*")
      .order("scheduled_date", { ascending: order.ascending })
      .order("id")
      .range(from, to),
  );
}

export async function fetchClientInterventions(role: StaffRole | null, clientId: string): Promise<Result<Intervention[]>> {
  if (role === "prestataire") {
    const { data, error } = await supabase
      .from("provider_interventions")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: false });
    return { data: data ? data.map(fromProviderView) : null, error };
  }
  return supabase.from("interventions").select("*").eq("client_id", clientId).order("scheduled_date", { ascending: false });
}

export async function fetchInterventionById(role: StaffRole | null, id: string): Promise<Result<Intervention>> {
  if (role === "prestataire") {
    const { data, error } = await supabase.from("provider_interventions").select("*").eq("id", id).single();
    return { data: data ? fromProviderView(data) : null, error };
  }
  return supabase.from("interventions").select("*").eq("id", id).single();
}
