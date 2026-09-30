import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

/**
 * Client + installation depuis une demande, en une transaction (convert_lead_to_client) :
 * réutilise le client lié ou un doublon exact (e-mail puis raison sociale), sinon le crée.
 * `markWon` passe aussi la demande en « gagnée » (conversion depuis la fiche prospect).
 */
export async function ensureClientAndInstallationFromLead(
  lead: Pick<Tables<"leads">, "id">,
  options: { markWon?: boolean } = {},
): Promise<{ clientId: string; installationId: string | null; created: boolean }> {
  const { data, error } = await supabase.rpc("convert_lead_to_client", {
    p_lead_id: lead.id,
    p_mark_won: options.markWon ?? false,
  });
  if (error) throw error;
  return { clientId: data.client_id, installationId: data.installation_id, created: data.created };
}
