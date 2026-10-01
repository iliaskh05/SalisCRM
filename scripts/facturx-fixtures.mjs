// Jeux de documents réalistes pour les tests Factur-X (mêmes données que les tests PDF).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { creditNoteToDocument, invoiceToDocument } from "../src/lib/pdf/document-model.ts";
import { calculateQuote } from "../src/lib/quotes/calculate.ts";

const asset = (name) => readFileSync(fileURLToPath(new URL(`../src/lib/pdf/assets/${name}`, import.meta.url)));
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

export function loadAssets({ withLogo = true } = {}) {
  const png = readFileSync(fileURLToPath(new URL("../public/brand/logo-salis.png", import.meta.url)));
  return {
    fonts: { regular: ab(asset("Roboto-Regular.ttf")), bold: ab(asset("Roboto-Bold.ttf")) },
    icc: ab(asset("sRGB.icc")),
    logo: withLogo ? { dataUrl: `data:image/png;base64,${png.toString("base64")}`, aspect: 490 / 849 } : null,
  };
}

const CLIENT = {
  company_name: "Brasserie du Vieux Port – Élise & Fils",
  contact_name: "Mme Élise Martin",
  address: "12 quai des Belges",
  postal_code: "13001",
  city: "Marseille",
  siret: "123 456 789 00012",
  email: "compta@vieuxport.fr",
  phone: "04 91 00 00 00",
};

function totalsFor(items, discount) {
  const c = calculateQuote(
    items.map((i) => ({ label: i.label, quantity: i.quantity, unitPriceHt: i.unit_price_ht, vatRate: i.vat_rate })),
    { discountHt: discount },
  );
  return { subtotal_ht: c.subtotalHt, discount_ht: c.discountHt, vat_amount: c.vatAmount, total_ttc: c.totalTtc };
}

const ROW = { id: "i1", client_id: "c1", quote_id: null, created_by: null, created_at: "2026-09-30T10:00:00Z", updated_at: "", cancelled_at: null, cancellation_reason: null, notes: "Accès par la cour arrière." };
const item = (n, label, description, quantity, unit_price_ht, vat_rate) => ({ id: `it${n}`, invoice_id: "i1", label, description, quantity, unit_price_ht, vat_rate, position: n, created_at: "" });

export function fixtures() {
  const basic = [
    item(0, "Dégraissage complet de la hotte d'extraction", "Démontage des filtres, dégraissage vapeur, remontage.", 1, 480, 20),
    item(1, "Filtres inox", null, 6, 24.9, 20),
    item(2, "Nettoyage conduits", "Sur 18 ml", 18, 32.45, 10),
  ];
  // Arrondis piégeux : nombreuses petites lignes (TVA par ligne ≠ TVA par groupe si mal gérée)
  const tricky = Array.from({ length: 9 }, (_, n) => item(n, `Petite prestation ${n + 1}`, null, 1, 0.33 + n * 0.07, 20));
  tricky.push(item(9, "Déplacement", null, 3, 13.37, 5.5));
  const zero = [item(0, "Prestation exonérée", null, 2, 100, 0), item(1, "Prestation taxée", null, 1, 50, 20)];

  const make = (number, items, discount, status, payments) =>
    invoiceToDocument({
      invoice: { ...ROW, number, issued_at: "2026-09-30", due_at: "2026-10-30", status, ...totalsFor(items, discount) },
      items,
      client: CLIENT,
      payments,
      quoteReference: null,
    });

  const payment = (amount) => ({ id: `p${amount}`, amount, paid_at: "2026-10-02", method: "transfer", reference: "VIR-1" });
  const credit = creditNoteToDocument({
    creditNote: { id: "cn", number: "AV-2026-0003", invoice_id: "i1", client_id: "c1", issued_at: "2026-10-05", reason: "Erreur de client", ...totalsFor(basic, 63.9), lines: basic, created_by: null, created_at: "" },
    client: CLIENT,
    invoiceNumber: "F-2026-0018",
    invoiceIssuedAt: "2026-09-30",
  });

  return {
    "facture-remise-2-taux": make("F-2026-0017", basic, 63.9, "partially_paid", [payment(500)]),
    "facture-arrondis": make("F-2026-0019", tricky, 0.41, "unpaid", []),
    "facture-tva-zero": make("F-2026-0020", zero, 0, "unpaid", []),
    "facture-sans-remise": make("F-2026-0021", basic, 0, "unpaid", []),
    "avoir": credit,
  };
}
