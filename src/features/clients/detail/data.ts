import type { TabItem } from "@/components/ui/tabs";
import { can, type Permission } from "@/lib/auth/permissions";
import { fetchClientInterventions } from "@/lib/interventions";
import { supabase } from "@/lib/supabase/client";
import type { StaffRole, Tables } from "@/lib/supabase/types";

/** Chaque onglet exige une permission : un prestataire ne voit ni devis, ni factures, ni paiements, ni documents. */
export const TABS: (TabItem & { permission: Permission })[] = [
  { id: "general", label: "Vue générale", permission: "clients:read" },
  { id: "installation", label: "Installation", permission: "installations:read" },
  { id: "interventions", label: "Interventions", permission: "interventions:read" },
  { id: "photos", label: "Photos", permission: "photos:read" },
  { id: "devis", label: "Devis", permission: "quotes:read" },
  { id: "factures", label: "Factures", permission: "invoices:read" },
  { id: "paiements", label: "Paiements", permission: "payments:read" },
  { id: "documents", label: "Documents", permission: "documents:read" },
  { id: "historique", label: "Historique", permission: "activities:read" },
];

export const visibleTabs = (role: StaffRole | null) => TABS.filter((t) => can(role, t.permission));

/**
 * Charge la fiche d'un client. On ne demande que ce que le rôle a le droit de lire : la base
 * renverrait de toute façon des listes vides (RLS), mais inutile de les interroger.
 */
export async function fetchClientBundle(id: string, role: StaffRole | null) {
  const allowed = (p: Permission) => can(role, p);
  const skipped = <T>(data: T) => Promise.resolve({ data, error: null });

  const [
    clientRes,
    installRes,
    interventionsRes,
    photosRes,
    quotesRes,
    invoicesRes,
    paymentsRes,
    documentsRes,
    activitiesRes,
    financialRes,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    allowed("installations:read")
      ? supabase.from("client_installations").select("*").eq("client_id", id).order("created_at")
      : skipped([]),
    allowed("interventions:read") ? fetchClientInterventions(role, id) : skipped([]),
    allowed("photos:read")
      ? supabase.from("intervention_photos").select("*").eq("client_id", id).order("created_at", { ascending: false })
      : skipped([]),
    allowed("quotes:read")
      ? supabase.from("quotes").select("*").eq("client_id", id).order("created_at", { ascending: false })
      : skipped([]),
    allowed("invoices:read") ? supabase.from("invoice_balances").select("*").eq("client_id", id) : skipped([]),
    allowed("payments:read")
      ? supabase.from("payments").select("*").eq("client_id", id).order("paid_at", { ascending: false })
      : skipped([]),
    allowed("documents:read")
      ? supabase.from("documents").select("*").eq("client_id", id).order("created_at", { ascending: false })
      : skipped([]),
    allowed("activities:read")
      ? supabase.from("activities").select("*").eq("client_id", id).order("created_at", { ascending: false })
      : skipped([]),
    allowed("finances:view")
      ? supabase.from("client_financial_summary").select("*").eq("client_id", id).maybeSingle()
      : skipped(null),
  ]);

  if (clientRes.error) throw clientRes.error;

  return {
    client: clientRes.data as Tables<"clients">,
    installations: (installRes.data ?? []) as Tables<"client_installations">[],
    interventions: (interventionsRes.data ?? []) as Tables<"interventions">[],
    photos: (photosRes.data ?? []) as Tables<"intervention_photos">[],
    quotes: (quotesRes.data ?? []) as Tables<"quotes">[],
    invoices: invoicesRes.data ?? [],
    payments: (paymentsRes.data ?? []) as Tables<"payments">[],
    documents: (documentsRes.data ?? []) as Tables<"documents">[],
    activities: (activitiesRes.data ?? []) as Tables<"activities">[],
    financial: financialRes.data,
  };
}
