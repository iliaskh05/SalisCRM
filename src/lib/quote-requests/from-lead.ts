import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import type { Tables } from "@/lib/supabase/types";

export async function findExistingClient(lead: Tables<"leads">): Promise<string | null> {
  if (lead.converted_client_id) return lead.converted_client_id;

  if (lead.email) {
    const { data } = await supabase.from("clients").select("id").ilike("email", lead.email).maybeSingle();
    if (data?.id) return data.id;
  }
  if (lead.company_name) {
    const { data } = await supabase.from("clients").select("id").ilike("company_name", lead.company_name).maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

export async function ensureClientAndInstallationFromLead(
  lead: Tables<"leads">,
  userId: string | null,
): Promise<{ clientId: string; installationId: string | null; created: boolean }> {
  const existingId = await findExistingClient(lead);
  let clientId = existingId;
  let created = false;

  if (!clientId) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        company_name: lead.company_name || lead.contact_name || "Client sans nom",
        contact_name: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        postal_code: lead.postal_code,
        business_type: lead.business_type,
        lead_id: lead.id,
        notes: lead.notes ?? lead.message,
        status: "active",
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    clientId = data.id;
    created = true;
    await logActivity({
      activity_type: "CLIENT_CREATED",
      title: "Client créé depuis une demande site",
      client_id: clientId,
      lead_id: lead.id,
      created_by: userId,
    });
  }

  const { data: installs } = await supabase
    .from("client_installations")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1);

  let installationId = installs?.[0]?.id ?? null;
  if (!installationId) {
    const { data: install, error } = await supabase
      .from("client_installations")
      .insert({
        client_id: clientId,
        label: "Installation principale",
        hood_length: lead.hood_length,
        hood_type: lead.hood_type,
        filter_count: lead.filter_count,
        filter_type: lead.filter_type,
        duct_present: lead.duct_present,
        duct_length: lead.duct_length,
        duct_accessibility: lead.accessibility,
        motor_present: lead.motor_present,
        motor_type: lead.motor_type,
        night_intervention: lead.night_intervention,
        schedule_preference: lead.schedule_preference,
        soil_level: lead.soil_level,
        remarks: lead.message,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    installationId = install.id;
  }

  if (!lead.converted_client_id) {
    await supabase
      .from("leads")
      .update({ converted_client_id: clientId, updated_at: new Date().toISOString() } as never)
      .eq("id", lead.id);
  }

  return { clientId, installationId, created };
}
