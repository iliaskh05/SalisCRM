import { supabase } from "@/lib/supabase/client";
import type { ActivityType, Json } from "@/lib/supabase/types";

export async function logActivity(input: {
  activity_type: ActivityType;
  title: string;
  description?: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  metadata?: Json;
  created_by?: string | null;
}) {
  const { error } = await supabase.from("activities").insert({
    activity_type: input.activity_type,
    title: input.title,
    description: input.description ?? null,
    client_id: input.client_id ?? null,
    lead_id: input.lead_id ?? null,
    metadata: input.metadata ?? {},
    created_by: input.created_by ?? null,
  });

  if (error) {
    console.error("[activities]", error.message);
  }
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value;
}
