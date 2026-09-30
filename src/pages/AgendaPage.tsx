import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { InterventionStatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import type { Tables } from "@/lib/supabase/types";

export function AgendaPage() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor] = useState(new Date());
  const query = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => {
      const [{ data: interventions, error }, { data: clients }] = await Promise.all([
        selectAll((from, to) => supabase.from("interventions").select("*").order("scheduled_date").order("id").range(from, to)),
        selectAll((from, to) => supabase.from("clients").select("id, company_name, city").order("id").range(from, to)),
      ]);
      if (error) throw error;
      return {
        interventions: (interventions ?? []) as Tables<"interventions">[],
        clients: clients ?? [],
      };
    },
  });

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1));
  }, [view, anchor]);

  if (query.isLoading) return <LoadingState />;
  const map = new Map((query.data?.clients ?? []).map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="Agenda"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant={view === "day" ? "accent" : "outline"} onClick={() => setView("day")}>Jour</Button>
            <Button size="sm" variant={view === "week" ? "accent" : "outline"} onClick={() => setView("week")}>Semaine</Button>
            <Button size="sm" variant={view === "month" ? "accent" : "outline"} onClick={() => setView("month")}>Mois</Button>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = (query.data?.interventions ?? []).filter((i) => i.scheduled_date === key);
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">{format(day, "EEEE d MMM", { locale: fr })}</p>
                <div className="mt-2 space-y-2">
                  {events.length === 0 ? <p className="text-xs text-muted-foreground">Aucun créneau</p> : events.map((ev) => (
                    <Link key={ev.id} to={`/interventions/${ev.id}`} className="block rounded-lg border p-2 text-sm">
                      <p className="font-medium">{map.get(ev.client_id)?.company_name}</p>
                      <p className="text-xs text-muted-foreground">{ev.time_slot} · {ev.service_type}</p>
                      <InterventionStatusBadge status={ev.status} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
