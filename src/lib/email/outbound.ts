import { COMPANY } from "@/lib/company";
import { isDemoMode } from "@/lib/demo/mode";

export type EmailProviderId = "none" | "demo";

export type PreparedEmail = {
  to: string;
  subject: string;
  body: string;
  from: string;
};

export type EmailDispatchResult = {
  delivered: false;
  provider: EmailProviderId;
  mode: "demo" | "ready";
  title: string;
  description: string;
};

export function getEmailProvider(): EmailProviderId {
  if (isDemoMode()) return "demo";
  const configured = import.meta.env.VITE_EMAIL_PROVIDER?.trim();
  if (!configured || configured === "none") return "none";
  return "none";
}

export function prepareQuoteEmail(input: {
  to: string;
  clientName: string;
  reference: string;
  validUntil?: string | null;
}): PreparedEmail {
  return {
    from: COMPANY.email,
    to: input.to,
    subject: `Devis ${input.reference} — ${COMPANY.legalName}`,
    body: [
      `Bonjour ${input.clientName},`,
      "",
      `Veuillez trouver ci-joint notre devis ${input.reference} pour le nettoyage / dégraissage de votre extraction.`,
      input.validUntil ? `Validité : jusqu’au ${input.validUntil}.` : null,
      "",
      "Nous restons à votre disposition pour toute précision technique.",
      "",
      COMPANY.legalName,
      COMPANY.phone,
      COMPANY.email,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

export function dispatchPreparedEmail(_email: PreparedEmail): EmailDispatchResult {
  const provider = getEmailProvider();
  if (provider === "demo") {
    return {
      delivered: false,
      provider,
      mode: "demo",
      title: "Email de démonstration préparé",
      description:
        "Aucun serveur SMTP n’est connecté. Le devis est marqué envoyé dans le CRM, sans transmission réelle.",
    };
  }
  return {
    delivered: false,
    provider: "none",
    mode: "ready",
    title: "Devis prêt à envoyer",
    description:
      "Aucun fournisseur e-mail n’est configuré. Le statut peut passer à « envoyé » côté CRM ; la transmission SMTP reste à brancher.",
  };
}
