import { COMPANY } from "@/lib/company";
import { isDemoMode } from "@/lib/demo/mode";
import { supabase } from "@/lib/supabase/client";
import { edgeFunctionError } from "@/lib/supabase/edge";

/**
 * "resend" : envoi réel via l'Edge Function send-document-email (VITE_EMAIL_PROVIDER=resend,
 * clé et domaine configurés côté Supabase). "none" : aucun envoi possible. "demo" : simulation.
 */
export type EmailProviderId = "none" | "demo" | "resend";

export type PreparedEmail = {
  to: string;
  subject: string;
  body: string;
  from: string;
};

export function getEmailProvider(): EmailProviderId {
  if (isDemoMode()) return "demo";
  return import.meta.env.VITE_EMAIL_PROVIDER?.trim() === "resend" ? "resend" : "none";
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Envoie l'e-mail avec le PDF en pièce jointe. Lève une erreur si l'envoi échoue. */
export async function sendEmailWithPdf(email: PreparedEmail, pdf: Blob, filename: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-document-email", {
    body: {
      to: email.to,
      subject: email.subject,
      text: email.body,
      filename,
      pdf_base64: await blobToBase64(pdf),
    },
  });
  if (error) throw new Error(await edgeFunctionError(error));
}
