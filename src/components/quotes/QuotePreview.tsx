import { BrandLogo } from "@/components/brand/BrandLogo";
import { COMPANY } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/format";
import type { QuoteTotals } from "@/lib/quotes/calculate";
import { cn } from "@/lib/utils";

export type QuotePreviewLine = {
  label: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPriceHt: number;
  vatRate: number;
  lineTotalHt: number;
};

export type QuotePreviewModel = {
  title?: string;
  reference: string;
  issuedAt: string;
  validUntil?: string | null;
  notes?: string;
  paymentTerms?: string;
  client: {
    name: string;
    contact?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    siret?: string;
    email?: string;
    phone?: string;
  };
  installation?: {
    label?: string;
    address?: string;
    hood?: string;
  } | null;
  lines: QuotePreviewLine[];
  totals: QuoteTotals;
};

export function QuotePreview({
  model,
  className,
  documentKind = "Devis",
}: {
  model: QuotePreviewModel;
  className?: string;
  documentKind?: "Devis" | "Facture";
}) {
  return (
    <article
      className={cn(
        "quote-sheet rounded-xl border border-border bg-white text-ink shadow-[0_18px_50px_-28px_rgba(15,23,42,.35)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-7 py-6">
        <div>
          <BrandLogo size="lg" className="mb-3" />
          <p className="text-xs leading-5 text-slate-600">
            {COMPANY.addressLine}
            <br />
            {COMPANY.postalCode} {COMPANY.city}
            <br />
            {COMPANY.phone} · {COMPANY.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-[0.18em] text-teal-700 uppercase">{documentKind}</p>
          <p className="mt-1 font-serif text-xl font-semibold">{model.reference}</p>
          <p className="mt-2 text-xs text-slate-500">Émis le {formatDate(model.issuedAt)}</p>
          {model.validUntil ? <p className="text-xs text-slate-500">Valable jusqu’au {formatDate(model.validUntil)}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 px-7 py-5 text-xs sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">Émetteur</p>
          <p className="mt-1 font-semibold">{COMPANY.legalName}</p>
          <p className="text-slate-600">
            SIREN {COMPANY.siren}
            <br />
            SIRET {COMPANY.siret}
            <br />
            TVA {COMPANY.vatNumber}
            <br />
            {COMPANY.rcs} · APE {COMPANY.ape}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">Client</p>
          <p className="mt-1 font-semibold">{model.client.name}</p>
          {model.client.contact ? <p>{model.client.contact}</p> : null}
          <p className="text-slate-600">
            {[model.client.address, [model.client.postalCode, model.client.city].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {model.client.siret ? <p>SIRET {model.client.siret}</p> : null}
          {model.client.phone ? <p>{model.client.phone}</p> : null}
          {model.client.email ? <p>{model.client.email}</p> : null}
        </div>
      </div>

      {model.installation ? (
        <div className="mx-7 mb-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-ink">Lieu d’intervention</span>
          <span className="mt-1 block">
            {model.installation.label}
            {model.installation.address ? ` — ${model.installation.address}` : ""}
            {model.installation.hood ? ` · ${model.installation.hood}` : ""}
          </span>
        </div>
      ) : null}

      <div className="px-7">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-y border-slate-200 text-[10px] tracking-wide text-slate-500 uppercase">
              <th className="py-2 font-semibold">Prestation</th>
              <th className="py-2 text-right font-semibold">Qté</th>
              <th className="py-2 text-right font-semibold">Unité</th>
              <th className="py-2 text-right font-semibold">PU HT</th>
              <th className="py-2 text-right font-semibold">TVA</th>
              <th className="py-2 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line, index) => (
              <tr key={`${line.label}-${index}`} className="border-b border-slate-100">
                <td className="py-2.5">
                  <p className="font-medium">{line.label}</p>
                  {line.description ? <p className="text-slate-500">{line.description}</p> : null}
                </td>
                <td className="py-2.5 text-right">{line.quantity}</td>
                <td className="py-2.5 text-right">{line.unit || "—"}</td>
                <td className="py-2.5 text-right">{formatCurrency(line.unitPriceHt)}</td>
                <td className="py-2.5 text-right">{line.vatRate}%</td>
                <td className="py-2.5 text-right font-medium">{formatCurrency(line.lineTotalHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 px-7 py-5 sm:grid-cols-[1.3fr_.9fr]">
        <div className="space-y-3 text-[11px] leading-5 text-slate-600">
          <p>
            <span className="font-semibold text-ink">Conditions de paiement</span>
            <br />
            {model.paymentTerms || COMPANY.paymentTermsDefault}
          </p>
          <p>{COMPANY.latePenalty}</p>
          {model.notes ? (
            <p>
              <span className="font-semibold text-ink">Notes</span>
              <br />
              {model.notes}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 text-sm">
          <Row label="Total HT" value={formatCurrency(model.totals.subtotalHt)} />
          {model.totals.discountHt > 0 ? (
            <Row label="Remise HT" value={`- ${formatCurrency(model.totals.discountHt)}`} />
          ) : null}
          <Row label="Net HT" value={formatCurrency(model.totals.taxableHt)} />
          <Row label="TVA" value={formatCurrency(model.totals.vatAmount)} />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>Total TTC</span>
            <span>{formatCurrency(model.totals.totalTtc)}</span>
          </div>
          {model.totals.deposit > 0 ? (
            <>
              <Row label="Acompte" value={formatCurrency(model.totals.deposit)} />
              <Row label="Reste à payer" value={formatCurrency(model.totals.remaining)} />
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-7 mb-7 grid gap-4 rounded-lg border border-dashed border-slate-300 p-4 text-xs sm:grid-cols-2">
        <div>
          <p className="font-semibold">Bon pour accord — client</p>
          <p className="mt-1 text-slate-500">Date, cachet et signature</p>
          <div className="mt-6 h-14 border-b border-slate-300" />
        </div>
        <div>
          <p className="font-semibold">{COMPANY.legalName}</p>
          <p className="mt-1 text-slate-500">Signature</p>
          <div className="mt-6 h-14 border-b border-slate-300" />
        </div>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function printElement(title: string) {
  const previous = document.title;
  document.title = title;
  window.print();
  document.title = previous;
}
