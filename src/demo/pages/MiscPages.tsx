import { HardHat, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemoStore } from "@/lib/demo/store";
import { formatCurrency } from "@/lib/format";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PageTitle } from "@/demo/ui";
import { toast } from "sonner";
import { useState } from "react";

export function DemoProvidersPage() {
  const { state } = useDemoStore();
  return (
    <>
      <PageTitle eyebrow="Ressources" title="Prestataires" />
      <div className="grid gap-5 lg:grid-cols-3">
        {state.providers.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100"><HardHat className="size-5" /></div>
                <Badge variant={p.status === "active" ? "success" : "outline"}>{p.status}</Badge>
              </div>
              <h2 className="mt-5 font-semibold">{p.name}</h2>
              <p className="text-sm text-muted-foreground">{p.specialty}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Zone</p><p className="font-medium">{p.zone}</p></div>
                <div><p className="text-muted-foreground">Coût mission</p><p className="font-medium">{formatCurrency(p.costRate)}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export function DemoProductsPage() {
  const { state } = useDemoStore();
  const catalog = [
    { name: "Dégraissant alcalin", category: "Dégraissant" },
    { name: "Nettoyant inox", category: "Inox" },
    { name: "Désinfectant surfaces", category: "Désinfectant" },
    { name: "Produit moteur", category: "Moteur" },
    { name: "Consommables", category: "Consommables" },
  ];
  return (
    <>
      <PageTitle eyebrow="Ressources" title="Produits" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Catalogue produits</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {catalog.map((p) => <div key={p.name} className="flex items-center gap-2"><Package className="size-4 text-muted-foreground" />{p.name}<span className="text-muted-foreground">· {p.category}</span></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Consommations enregistrées</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.products.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>{p.name} · {p.quantity} {p.unit}</span>
                <span>{formatCurrency(p.quantity * p.unitCost)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function DemoSettingsPage() {
  const { state, updateSettings, updateCatalogItem, approveUser, resetDemo, isProvider } = useDemoStore();
  const [settings, setSettings] = useState(state.settings);
  if (isProvider) return <p>Paramètres réservés à la direction.</p>;

  return (
    <>
      <PageTitle eyebrow="Administration" title="Paramètres" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Société</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <BrandLogo size="md" />
            <p>Salis 3 Hottes · 12 rue de la Fontaine, 75011 Paris</p>
            <p>SIREN 848 392 017 · SIRET 848 392 017 00017 · TVA FR48 848392017</p>
            <p>IBAN : prêt à renseigner · aucune banque connectée</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Devis & factures</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Input value={settings.quotePrefix} onChange={(e) => setSettings((s) => ({ ...s, quotePrefix: e.target.value }))} />
            <Input type="number" value={settings.quoteValidityDays} onChange={(e) => setSettings((s) => ({ ...s, quoteValidityDays: Number(e.target.value) }))} />
            <Input type="number" value={settings.defaultVat} onChange={(e) => setSettings((s) => ({ ...s, defaultVat: Number(e.target.value) }))} />
            <Input value={settings.paymentTerms} onChange={(e) => setSettings((s) => ({ ...s, paymentTerms: e.target.value }))} />
            <Button onClick={() => { updateSettings(settings); toast.success("Paramètres enregistrés"); }}>Enregistrer</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Catalogue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {state.catalog.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_90px] gap-2 text-sm">
                <span>{s.label}</span>
                <Input type="number" defaultValue={s.unitPriceHt} onBlur={(e) => updateCatalogItem(s.id, { unitPriceHt: Number(e.target.value) })} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Utilisateurs</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {state.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · {ROLE_LABELS[u.role]} · {u.status}</p>
                </div>
                {u.status === "pending_approval" ? (
                  <Button size="sm" onClick={() => { approveUser(u.id, u.requestedRole); toast.success("Compte activé"); }}>Approuver</Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Zones</CardTitle></CardHeader>
          <CardContent className="text-sm">Paris · Île-de-France · Lyon · Dijon · Troyes</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Démonstration</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => { resetDemo(); toast.success("Jeu de données réinitialisé"); }}>Réinitialiser les données de démo</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
