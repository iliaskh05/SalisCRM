import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export function CatalogPage() {
  const query = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_catalog").select("*").order("label");
      if (error) throw error;
      return (data ?? []) as Tables<"service_catalog">[];
    },
  });
  if (query.isLoading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Catalogue prestations" />
      <Card>
        <CardContent className="divide-y p-0">
          {(query.data ?? []).map((s) => (
            <div key={s.id} className="flex justify-between px-5 py-3 text-sm">
              <span>{s.label}</span>
              <span>{s.unit_price_ht} € HT / {s.unit}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
