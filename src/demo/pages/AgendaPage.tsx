import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDemoStore } from "@/lib/demo/store";
import { InterventionBadge, PageTitle } from "@/demo/ui";

export function DemoAgendaPage() {
  const { state, isProvider, currentUser } = useDemoStore();
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [city, setCity] = useState("");
  const [providerId, setProviderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [anchor] = useState(new Date("2026-09-08T00:00:00"));

  const mine = state.providers.find((p) => p.userId === currentUser?.id);
  const items = state.interventions.filter((i) => {
    if (isProvider && mine && i.providerId !== mine.id) return false;
    if (city && i.city !== city) return false;
    if (providerId && i.providerId !== providerId) return false;
    if (clientId && i.clientId !== clientId) return false;
    if (status && i.status !== status) return false;
    return i.status !== "cancelled";
  });

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1));
  }, [view, anchor]);

  return (
    <>
      <PageTitle eyebrow="Opérations" title="Agenda">
        <div className="flex gap-2">
          <Button variant={view === "day" ? "accent" : "outline"} size="sm" onClick={() => setView("day")}>Jour</Button>
          <Button variant={view === "week" ? "accent" : "outline"} size="sm" onClick={() => setView("week")}>Semaine</Button>
          <Button variant={view === "month" ? "accent" : "outline"} size="sm" onClick={() => setView("month")}>Mois</Button>
        </div>
      </PageTitle>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {["Paris", "Lyon", "Dijon", "Troyes"].map((c) => <option key={c}>{c}</option>)}
        </Select>
        {!isProvider ? (
          <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">Tous les prestataires</option>
            {state.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        ) : null}
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Tous les clients</option>
          {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="planned">Planifiée</option>
          <option value="confirmed">Confirmée</option>
          <option value="in_progress">En cours</option>
        </Select>
      </div>
      <div className={`grid gap-3 ${view === "month" ? "sm:grid-cols-3 lg:grid-cols-7" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = items.filter((i) => i.date === key);
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{format(day, "EEEE d MMM", { locale: fr })}</p>
                <div className="mt-3 space-y-2">
                  {events.length === 0 ? <p className="text-xs text-muted-foreground">Aucun créneau</p> : events.map((ev) => (
                    <Link key={ev.id} to={`/interventions/${ev.id}`} className="block rounded-lg border border-border p-2 hover:bg-muted/50">
                      <p className="text-xs font-semibold">{ev.startTime}–{ev.endTime}</p>
                      <p className="text-sm">{state.clients.find((c) => c.id === ev.clientId)?.name}</p>
                      <p className="text-xs text-muted-foreground">{ev.city} · {ev.service}</p>
                      <p className="text-xs">{state.providers.find((p) => p.id === ev.providerId)?.name}</p>
                      <InterventionBadge status={ev.status} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
