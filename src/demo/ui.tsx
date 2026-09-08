import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  INTERVENTION_WORKFLOW_LABELS,
  QUOTE_WORKFLOW_LABELS,
  type InterventionWorkflowStatus,
  type QuoteWorkflowStatus,
} from "@/lib/quotes/labels";
import type { LucideIcon } from "lucide-react";

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "teal" | "navy" | "amber" | "rose";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    navy: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <Card className="overflow-hidden border-0 shadow-[0_10px_30px_-18px_rgba(15,23,42,.32)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function TableWrap({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-muted/60 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          <tr>
            {headers.map((h) => (
              <th className="px-5 py-3" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 ${className}`}>{children}</td>;
}

export function QuoteBadge({ status }: { status: QuoteWorkflowStatus }) {
  const variant =
    status === "accepted" || status === "converted_intervention" || status === "converted_invoice"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "expired"
          ? "warning"
          : status === "sent" || status === "viewed" || status === "pending" || status === "ready"
            ? "accent"
            : "default";
  return <Badge variant={variant}>{QUOTE_WORKFLOW_LABELS[status]}</Badge>;
}

export function InterventionBadge({ status }: { status: InterventionWorkflowStatus }) {
  const variant =
    status === "cancelled"
      ? "danger"
      : status === "completed" || status === "report_validated" || status === "invoiced" || status === "closed"
        ? "success"
        : status === "to_plan" || status === "report_pending"
          ? "warning"
          : "accent";
  return <Badge variant={variant}>{INTERVENTION_WORKFLOW_LABELS[status]}</Badge>;
}

export function InvoiceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "danger" | "accent" | "outline" | "default" }> = {
    paid: { label: "Payée", variant: "success" },
    partial: { label: "Partielle", variant: "warning" },
    overdue: { label: "En retard", variant: "danger" },
    unpaid: { label: "Impayée", variant: "warning" },
    cancelled: { label: "Annulée", variant: "outline" },
  };
  const item = map[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
