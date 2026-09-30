// Tests facturation : numérotation, totaux, verrouillage, avoirs, paiements.
// Lancer : npm run test:db
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateQuote } from "../../src/lib/quotes/calculate.ts";
import { createTestDb, MIG, USERS } from "./_harness.mjs";

const { db, as, ok, rejects, done, asAdmin, asComm, asSuper } = await createTestDb();
const RANDO = USERS.RANDO;

console.log("\n# Numérotation client");
const c = (await asComm(`INSERT INTO clients (company_name) VALUES ('Brasserie Test') RETURNING id, reference`)).rows[0];
ok("référence client auto", /^CLI-\d{4}-0001$/.test(c.reference), c.reference);

console.log("\n# Devis + remise (même calcul que le front)");
const lines = [
  { label: "Dégraissage hotte", quantity: 2, unit_price_ht: 99.99, vat_rate: 20 },
  { label: "Filtres", quantity: 3, unit_price_ht: 13.33, vat_rate: 10 },
  { label: "Déplacement", quantity: 1, unit_price_ht: 45.5, vat_rate: 20 },
];
const discount = 25.37;
const qid = (await asComm(`SELECT create_quote($1, $2::jsonb, p_discount_ht => $3) AS id`, [c.id, JSON.stringify(lines), discount])).rows[0].id;
const q = (await asComm(`SELECT * FROM quotes WHERE id = $1`, [qid])).rows[0];
const js = calculateQuote(lines.map((l) => ({ label: l.label, quantity: l.quantity, unitPriceHt: l.unit_price_ht, vatRate: l.vat_rate })), { discountHt: discount });
ok("référence devis D-", /^D-\d{4}-0001$/.test(q.reference), q.reference);
ok("sous-total HT = front", Number(q.subtotal_ht) === js.subtotalHt, `${q.subtotal_ht} vs ${js.subtotalHt}`);
ok("TVA = front", Number(q.vat_amount) === js.vatAmount, `${q.vat_amount} vs ${js.vatAmount}`);
ok("TTC = front (remise incluse)", Number(q.total_ttc) === js.totalTtc, `${q.total_ttc} vs ${js.totalTtc}`);
await rejects("remise > sous-total refusée", () => asComm(`SELECT create_quote($1, $2::jsonb, p_discount_ht => 99999)`, [c.id, JSON.stringify(lines)]), "remise");
await rejects("ligne sans libellé refusée", () => asComm(`SELECT create_quote($1, '[{"label":"","quantity":1,"unit_price_ht":1}]'::jsonb)`, [c.id]), "libellé");

console.log("\n# Transitions / verrouillage devis");
await asComm(`UPDATE quotes SET status = 'sent' WHERE id = $1`, [qid]);
await rejects("sent → draft interdit", () => asComm(`UPDATE quotes SET status = 'draft' WHERE id = $1`, [qid]), "interdit");
await rejects("modifier une ligne d'un devis envoyé", () => asComm(`UPDATE quote_items SET unit_price_ht = 1 WHERE quote_id = $1`, [qid]), "verrouillées");
await rejects("modifier la remise d'un devis envoyé", () => asComm(`UPDATE quotes SET discount_ht = 0 WHERE id = $1`, [qid]), "verrouillé");
await asComm(`UPDATE quotes SET notes = 'rappel client' WHERE id = $1`, [qid]);
ok("notes modifiables hors brouillon", (await asComm(`SELECT notes FROM quotes WHERE id=$1`, [qid])).rows[0].notes === "rappel client");

console.log("\n# Facture depuis devis");
const inv1 = (await asComm(`SELECT create_invoice_from_quote($1) AS id`, [qid])).rows[0].id;
const i1 = (await asComm(`SELECT * FROM invoices WHERE id = $1`, [inv1])).rows[0];
ok("numéro F-AAAA-0001", /^F-\d{4}-0001$/.test(i1.number), i1.number);
ok("TTC facture = TTC devis", Number(i1.total_ttc) === Number(q.total_ttc), `${i1.total_ttc} vs ${q.total_ttc}`);
ok("remise reportée sur la facture", Number(i1.discount_ht) === discount);
ok("devis passé en accepté", (await asComm(`SELECT status FROM quotes WHERE id=$1`, [qid])).rows[0].status === "accepted");
await rejects("double facturation du devis refusée", () => asComm(`SELECT create_invoice_from_quote($1)`, [qid]), "déjà facturé");

console.log("\n# Facture immuable");
await rejects("INSERT direct interdit", () => asComm(`INSERT INTO invoices (client_id) VALUES ($1)`, [c.id]), "permission denied");
await rejects("UPDATE direct interdit", () => asComm(`UPDATE invoices SET total_ttc = 1 WHERE id = $1`, [inv1]), "permission denied");
await rejects("DELETE admin interdit", () => asAdmin(`DELETE FROM invoices WHERE id = $1`, [inv1]), "permission denied");
await rejects("même le superuser ne change pas le montant", () => asSuper(`UPDATE invoices SET total_ttc = 1 WHERE id = $1`, [inv1]), "émise");
await rejects("même le superuser ne supprime pas", () => asSuper(`DELETE FROM invoices WHERE id = $1`, [inv1]), "avoir");
await rejects("lignes non modifiables (superuser)", () => asSuper(`UPDATE invoice_items SET quantity = 9 WHERE invoice_id = $1`, [inv1]), "émise");
await rejects("suppression client avec facture bloquée", () => asSuper(`DELETE FROM clients WHERE id = $1`, [c.id]));

console.log("\n# Paiements");
const total = Number(i1.total_ttc);
await rejects("sur-encaissement refusé", () => asComm(`INSERT INTO payments (invoice_id, client_id, amount) VALUES ($1, $2, $3)`, [inv1, c.id, total + 1]), "dépasse");
const other = (await asComm(`INSERT INTO clients (company_name) VALUES ('Autre') RETURNING id`)).rows[0].id;
await asComm(`INSERT INTO payments (invoice_id, client_id, amount) VALUES ($1, $2, 100)`, [inv1, other]);
const p = (await asComm(`SELECT client_id FROM payments WHERE invoice_id = $1`, [inv1])).rows[0];
ok("client du paiement forcé = client facture", p.client_id === c.id);
ok("statut partiellement payée", (await asComm(`SELECT status FROM invoices WHERE id=$1`, [inv1])).rows[0].status === "partially_paid");
await asComm(`INSERT INTO payments (invoice_id, client_id, amount) VALUES ($1, $2, $3)`, [inv1, c.id, Math.round((total - 100) * 100) / 100]);
ok("statut payée", (await asComm(`SELECT status FROM invoices WHERE id=$1`, [inv1])).rows[0].status === "paid");

console.log("\n# Numérotation sans trou");
await rejects("facture invalide (qté 0)", () => asComm(`SELECT create_invoice($1, '[{"label":"x","quantity":0,"unit_price_ht":10}]'::jsonb)`, [c.id]), "Quantité");
const inv2 = (await asComm(`SELECT create_invoice($1, '[{"label":"Contrat","quantity":1,"unit_price_ht":200,"vat_rate":20}]'::jsonb) AS id`, [c.id])).rows[0].id;
const i2 = (await asComm(`SELECT number, total_ttc, issued_at, due_at FROM invoices WHERE id=$1`, [inv2])).rows[0];
ok("numéro suivant = 0002 (échec précédent sans trou)", /-0002$/.test(i2.number), i2.number);
ok("TTC 240", Number(i2.total_ttc) === 240, i2.total_ttc);
ok("échéance par défaut J+30", (new Date(i2.due_at) - new Date(i2.issued_at)) / 86400000 === 30);

console.log("\n# Avoir / annulation");
await rejects("commercial ne peut pas annuler", () => asComm(`SELECT cancel_invoice($1, 'erreur')`, [inv2]), "direction");
await rejects("motif obligatoire", () => asAdmin(`SELECT cancel_invoice($1, '  ')`, [inv2]), "motif");
await rejects("facture avec paiements non annulable", () => asAdmin(`SELECT cancel_invoice($1, 'erreur')`, [inv1]), "paiements");
const cn = (await asAdmin(`SELECT cancel_invoice($1, 'Erreur de client') AS id`, [inv2])).rows[0].id;
const cnr = (await asAdmin(`SELECT number, total_ttc, jsonb_array_length(lines) AS n FROM credit_notes WHERE id=$1`, [cn])).rows[0];
ok("avoir AV-AAAA-0001", /^AV-\d{4}-0001$/.test(cnr.number), cnr.number);
ok("avoir = total facture + lignes copiées", Number(cnr.total_ttc) === 240 && cnr.n === 1);
ok("facture annulée", (await asAdmin(`SELECT status FROM invoices WHERE id=$1`, [inv2])).rows[0].status === "cancelled");
await rejects("paiement sur facture annulée refusé", () => asComm(`INSERT INTO payments (invoice_id, client_id, amount) VALUES ($1, $2, 10)`, [inv2, c.id]), "annulée");
await rejects("avoir immuable", () => asSuper(`UPDATE credit_notes SET reason = 'x' WHERE id = $1`, [cn]), "avoir");
await rejects("facture annulée figée", () => asSuper(`UPDATE invoices SET notes = 'x' WHERE id = $1`, [inv2]), "annulée");

console.log("\n# Droits");
await rejects("utilisateur sans profil staff", () => as("authenticated", RANDO, `SELECT create_invoice($1, '[{"label":"x","quantity":1,"unit_price_ht":1}]'::jsonb)`, [c.id]), "Accès refusé");
await rejects("next_document_ref fermé", () => as("authenticated", RANDO, `SELECT next_document_ref('F')`), "permission denied");
await rejects("assign_document_ref fermé", () => asComm(`SELECT assign_document_ref('F', current_date)`), "permission denied");
await rejects("anon ne crée pas de devis", () => as("anon", null, `SELECT create_quote($1, '[]'::jsonb)`, [c.id]), "permission denied");
await rejects("recompute interne fermé", () => asComm(`SELECT recompute_invoice_totals($1)`, [inv1]), "permission denied");

console.log("\n# Tâche quotidienne");
const inv3 = (await asComm(`SELECT create_invoice($1, '[{"label":"y","quantity":1,"unit_price_ht":50}]'::jsonb) AS id`, [c.id])).rows[0].id;
await db.exec(`ALTER TABLE invoices DISABLE TRIGGER invoices_guard; UPDATE invoices SET due_at = current_date - 5 WHERE id = '${inv3}'; ALTER TABLE invoices ENABLE TRIGGER invoices_guard;`);
const q2 = (await asComm(`SELECT create_quote($1, '[{"label":"z","quantity":1,"unit_price_ht":10}]'::jsonb) AS id`, [c.id])).rows[0].id;
await db.exec(`ALTER TABLE quotes DISABLE TRIGGER quotes_guard; UPDATE quotes SET status = 'sent', valid_until = current_date - 1 WHERE id = '${q2}'; ALTER TABLE quotes ENABLE TRIGGER quotes_guard;`);
await asSuper(`SELECT run_daily_billing_maintenance()`);
ok("facture échue → en retard", (await asSuper(`SELECT status FROM invoices WHERE id=$1`, [inv3])).rows[0].status === "overdue");
ok("devis périmé → expiré", (await asSuper(`SELECT status FROM quotes WHERE id=$1`, [q2])).rows[0].status === "expired");

console.log("\n# Idempotence");
try {
  await db.exec(readFileSync(join(MIG, "20260929100000_invoicing_integrity.sql"), "utf8"));
  ok("migration rejouable", true);
} catch (e) {
  ok("migration rejouable", false, e.message);
}

done();
