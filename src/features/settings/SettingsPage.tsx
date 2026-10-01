import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { COMPANY } from "@/lib/company";
import { StaffAccessManager } from "./StaffAccessManager";
import { RetentionManager } from "./RetentionManager";
import { SecurityPolicyCard } from "./SecurityPolicyCard";

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" description="Accès de l’équipe, identité société et catalogue." />
      <StaffAccessManager />
      <div className="mt-4">
        <SecurityPolicyCard />
      </div>
      <div className="mt-4">
        <RetentionManager />
      </div>
      <Card className="mt-4">
        <CardContent className="space-y-3 pt-5 text-sm">
          <BrandLogo size="md" />
          <p>{COMPANY.legalName} · {COMPANY.addressLine}, {COMPANY.postalCode} {COMPANY.city}</p>
          <p>SIREN {COMPANY.siren} · SIRET {COMPANY.siret} · TVA {COMPANY.vatNumber}</p>
          <p>Facturation électronique : les factures et avoirs se téléchargent au format Factur-X. Aucune plateforme agréée (PDP) n’est connectée : la transmission reste à votre charge.</p>
          <Link to="/produits" className="text-teal-700">Ouvrir le catalogue</Link>
        </CardContent>
      </Card>
    </div>
  );
}
