import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

export function useLeadsInboxRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("leads-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const row = payload.new as { company_name?: string; contact_name?: string; city?: string };
        toast.info("Nouvelle demande de devis", {
          description: [row.company_name || row.contact_name, row.city].filter(Boolean).join(" · ") || "Formulaire site",
        });
        void qc.invalidateQueries({ queryKey: ["leads"] });
        void qc.invalidateQueries({ queryKey: ["quote-requests"] });
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, () => {
        void qc.invalidateQueries({ queryKey: ["leads"] });
        void qc.invalidateQueries({ queryKey: ["quote-requests"] });
        void qc.invalidateQueries({ queryKey: ["lead"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
