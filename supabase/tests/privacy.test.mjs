// Tests RGPD et double authentification : export, anonymisation, purge, MFA appliquée par la base.
// Lancer : npm run test:db
import { createTestDb, USERS } from "./_harness.mjs";

const { db, as, ok, rejects, done, asAdmin, asComm, asSuper } = await createTestDb();
const { ADMIN, COMM } = USERS;
const rows = async (p) => (await p).rows;
const one = async (p) => (await p).rows[0];

console.log("\n# Double authentification appliquée par la base");
const SALES_SQL = `SELECT create_quote($1, '[{"label":"x","quantity":1,"unit_price_ht":10}]'::jsonb) AS id`;
const [cli] = await rows(asComm(`INSERT INTO clients (company_name, contact_name, email, phone, notes) VALUES ('Bistro Test', 'Paul Martin', 'paul@bistro.fr', '0600000000', 'Allergique, code 1234') RETURNING id`));
ok("sans facteur MFA : accès normal en aal1", (await rows(asComm(`SELECT id FROM clients`))).length === 1);

await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')`, [COMM]);
ok("MFA activée + session aal1 : plus aucune donnée", (await rows(asComm(`SELECT id FROM clients`))).length === 0);
await rejects("MFA activée + session aal1 : écriture refusée", () => asComm(SALES_SQL, [cli.id]), "Accès refusé");
ok("MFA activée + session aal2 : accès rétabli", (await rows(as("authenticated", COMM, `SELECT id FROM clients`, [], { aal: "aal2" }))).length === 1);
ok("MFA activée + aal2 : écriture possible", Boolean((await one(as("authenticated", COMM, SALES_SQL, [cli.id], { aal: "aal2" }))).id));
ok("facteur non vérifié : pas de blocage", await (async () => {
  await db.query(`UPDATE auth.mfa_factors SET status = 'unverified' WHERE user_id = $1`, [COMM]);
  return (await rows(asComm(`SELECT id FROM clients`))).length === 1;
})());
await db.query(`DELETE FROM auth.mfa_factors`);
ok("le profil reste lisible pour l'écran de code MFA", await (async () => {
  await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')`, [ADMIN]);
  const own = await rows(asAdmin(`SELECT role FROM staff_profiles WHERE user_id = $1`, [ADMIN]));
  return own.length === 1 && own[0].role === "admin";
})());
await rejects("admin en aal1 : fonctions admin refusées", () => asAdmin(`SELECT list_staff_users()`), "direction");
await db.query(`DELETE FROM auth.mfa_factors`);

console.log("\n# Jeu de données client");
const [lead] = await rows(asSuper(`INSERT INTO leads (email, phone, company_name, contact_name, message, status, photos) VALUES ('paul@bistro.fr', '0600000000', 'Bistro Test', 'Paul Martin', 'Bonjour, hotte encrassée, tel perso 0600000000', 'quote_requested', '["leads/a.jpg"]') RETURNING id`));
await asSuper(`UPDATE clients SET lead_id = $2 WHERE id = $1`, [cli.id, lead.id]);
await asSuper(`UPDATE leads SET converted_client_id = $2 WHERE id = $1`, [lead.id, cli.id]);
await asComm(`INSERT INTO client_installations (client_id, remarks) VALUES ($1, 'Code portail 4321, demander Paul')`, [cli.id]);
await asComm(`SELECT create_invoice($1, '[{"label":"Dégraissage","quantity":1,"unit_price_ht":200}]'::jsonb)`, [cli.id]);
await asComm(`UPDATE clients SET notes = 'Préfère être appelé après 18h' WHERE id = $1`, [cli.id]); // génère une entrée d'audit avec l'ancienne valeur

console.log("\n# Export des données d'un client");
await rejects("réservé à la direction", () => asComm(`SELECT export_client_data($1)`, [cli.id]), "direction");
const exp = (await one(asAdmin(`SELECT export_client_data($1) AS d`, [cli.id]))).d;
ok("contient client, factures et lignes", exp.client.company_name === "Bistro Test" && exp.factures.length === 1 && exp.factures[0].lignes.length === 1);
ok("contient la demande d'origine et les installations", exp.demandes.length === 1 && exp.installations.length === 1);
ok("contient les devis du client", exp.devis.length >= 1 && Array.isArray(exp.devis[0].lignes));
ok("l'export est journalisé", (await rows(asAdmin(`SELECT 1 FROM audit_log WHERE action = 'EXPORT' AND record_id = $1`, [cli.id]))).length === 1);

console.log("\n# Anonymisation");
await rejects("réservé à la direction", () => asComm(`SELECT anonymize_client($1, 'demande')`, [cli.id]), "direction");
await rejects("motif obligatoire", () => asAdmin(`SELECT anonymize_client($1, '  ')`, [cli.id]), "motif");
await rejects("nom conservé si facturé", () => asAdmin(`SELECT anonymize_client($1, 'demande', true)`, [cli.id]), "10 ans");
const res = (await one(asAdmin(`SELECT anonymize_client($1, 'Demande de la personne') AS r`, [cli.id]))).r;
const after = await one(asSuper(`SELECT * FROM clients WHERE id = $1`, [cli.id]));
ok("coordonnées effacées", after.contact_name === null && after.email === null && after.phone === null && after.notes === null);
ok("raison sociale conservée (factures), client archivé", after.company_name === "Bistro Test" && after.status === "archived");
const l = await one(asSuper(`SELECT * FROM leads WHERE id = $1`, [lead.id]));
ok("demande d'origine anonymisée", l.email === null && l.phone === null && l.contact_name === null && l.message === null && JSON.stringify(l.photos) === "[]");
ok("remarques d'installation effacées", (await one(asSuper(`SELECT remarks FROM client_installations WHERE client_id = $1`, [cli.id]))).remarks === null);
ok("la facture est intacte", (await rows(asSuper(`SELECT id FROM invoices WHERE client_id = $1`, [cli.id]))).length === 1);
ok("résultat : demande anonymisée + documents à vérifier", res.leads_anonymized === 1 && Array.isArray(res.documents_to_review));

const auditText = JSON.stringify(await rows(asSuper(`SELECT changes FROM audit_log WHERE table_name IN ('clients','leads','client_installations')`)));
for (const secret of ["paul@bistro.fr", "0600000000", "Paul Martin", "Allergique", "après 18h", "4321"]) {
  ok(`« ${secret} » n'est plus dans le journal d'audit`, !auditText.includes(secret));
}
ok("l'anonymisation est journalisée avec son motif", JSON.stringify(await rows(asAdmin(`SELECT changes FROM audit_log WHERE action = 'ANONYMIZE'`))).includes("Demande de la personne"));
await rejects("le journal reste protégé en dehors de la purge", () => asSuper(`UPDATE audit_log SET changes = '{}'`), "lecture seule");

const [free] = await rows(asComm(`INSERT INTO clients (company_name, contact_name, email) VALUES ('Particulier X', 'Jeanne Dupont', 'j@x.fr') RETURNING id`));
await asAdmin(`SELECT anonymize_client($1, 'Demande', true)`, [free.id]);
ok("client sans facture : nom aussi anonymisable", (await one(asSuper(`SELECT company_name FROM clients WHERE id = $1`, [free.id]))).company_name === "Client anonymisé");

console.log("\n# Purge des demandes anciennes");
const old = "now() - interval '4 years'";
const [oldLead] = await rows(asSuper(`INSERT INTO leads (email, contact_name, status, created_at, photos) VALUES ('vieux@x.fr', 'Ancien Prospect', 'lost', ${old}, '["leads/old1.jpg", {"storage_path":"leads/old2.jpg"}, {"url":"https://evil.example/x.png"}]') RETURNING id`));
const [oldQuoted] = await rows(asSuper(`INSERT INTO leads (email, status, created_at) VALUES ('devis@x.fr', 'quote_sent', ${old}) RETURNING id`));
await asSuper(`INSERT INTO quotes (client_id, lead_id, status) VALUES ($1, $2, 'draft')`, [cli.id, oldQuoted.id]);
const [oldWon] = await rows(asSuper(`INSERT INTO leads (email, status, created_at) VALUES ('gagne@x.fr', 'won', ${old}) RETURNING id`));
const [recent] = await rows(asSuper(`INSERT INTO leads (email, status) VALUES ('recent@x.fr', 'new') RETURNING id`));

await rejects("réservé à la direction", () => asComm(`SELECT purge_expired_leads()`), "direction");
await rejects("durée minimale 12 mois", () => asAdmin(`SELECT purge_expired_leads(3, false)`), "12 et 120");
const dry = (await one(asAdmin(`SELECT purge_expired_leads() AS r`))).r;
ok("simulation par défaut : compte sans rien supprimer", dry.dry_run === true && dry.candidates === 1 && dry.deleted === 0);
ok("simulation : la demande existe toujours", (await rows(asSuper(`SELECT 1 FROM leads WHERE id = $1`, [oldLead.id]))).length === 1);
ok("chemins Storage listés (pas les URL externes)", JSON.stringify(dry.storage_paths.sort()) === JSON.stringify(["leads/old1.jpg", "leads/old2.jpg"]), JSON.stringify(dry.storage_paths));
const real = (await one(asAdmin(`SELECT purge_expired_leads(36, false) AS r`))).r;
ok("suppression réelle : 1 demande", real.deleted === 1 && real.dry_run === false);
ok("supprimée : ancienne demande non convertie", (await rows(asSuper(`SELECT 1 FROM leads WHERE id = $1`, [oldLead.id]))).length === 0);
ok("conservées : avec devis, gagnée, récente", (await rows(asSuper(`SELECT id FROM leads WHERE id = ANY($1)`, [[oldQuoted.id, oldWon.id, recent.id]]))).length === 3);
ok("e-mail de la demande purgée retiré de l'audit", !JSON.stringify(await rows(asSuper(`SELECT changes FROM audit_log WHERE table_name = 'leads'`))).includes("vieux@x.fr"));

console.log("\n# Politique MFA de la direction (interrupteur)");
const { RANDO } = USERS;
const aal2 = { aal: "aal2" };
const asAs = (uid, sql, p, claims) => as("authenticated", uid, sql, p, claims);
ok("désactivée par défaut", (await one(asAdmin(`SELECT security_policy() AS p`))).p.require_admin_mfa === false);
await rejects("impossible de l'activer sans avoir soi-même la MFA", () => asAdmin(`SELECT set_require_admin_mfa(true)`), "Activez d");
await rejects("réservé à la direction", () => asComm(`SELECT set_require_admin_mfa(false)`), "direction");

await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')`, [ADMIN]);
await rejects("activation depuis une session aal1 refusée", () => asAdmin(`SELECT set_require_admin_mfa(true)`), "direction");
await asAs(ADMIN, `SELECT set_require_admin_mfa(true)`, [], aal2);
ok("activée depuis une session aal2", (await one(asAs(ADMIN, `SELECT security_policy() AS p`, [], aal2))).p.require_admin_mfa === true);

await asSuper(`INSERT INTO staff_profiles (user_id, role) VALUES ($1, 'admin')`, [RANDO]);
ok("administrateur sans MFA : plus aucun droit d'administration", (await one(asAs(RANDO, `SELECT is_admin() AS v`))).v === false);
ok("… ni accès aux données", (await rows(asAs(RANDO, `SELECT id FROM clients`))).length === 0);
ok("… mais son profil reste lisible (pour l'écran d'activation)", (await rows(asAs(RANDO, `SELECT role FROM staff_profiles WHERE user_id = $1`, [RANDO]))).length === 1);
ok("… et la politique lui est lisible (pour savoir quoi faire)", (await one(asAs(RANDO, `SELECT security_policy() AS p`))).p.require_admin_mfa === true);
ok("commercial non concerné par l'obligation", (await rows(asComm(`SELECT id FROM clients`))).length > 0);

const staff = await rows(asAs(ADMIN, `SELECT user_id, mfa_enabled FROM list_staff_users()`, [], aal2));
ok("la direction voit qui a activé la MFA", staff.find((s) => s.user_id === ADMIN)?.mfa_enabled === true && staff.find((s) => s.user_id === RANDO)?.mfa_enabled === false);

await db.query(`INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')`, [RANDO]);
ok("MFA activée mais code pas encore saisi (aal1) : toujours bloqué", (await one(asAs(RANDO, `SELECT is_admin() AS v`))).v === false);
ok("MFA activée + code saisi (aal2) : accès rétabli", (await one(asAs(RANDO, `SELECT is_admin() AS v`, [], aal2))).v === true);

await db.query(`DELETE FROM auth.mfa_factors WHERE user_id = $1`, [RANDO]);
await asAs(ADMIN, `SELECT set_require_admin_mfa(false)`, [], aal2);
ok("désactivée : l'administrateur sans MFA retrouve l'accès", (await one(asAs(RANDO, `SELECT is_admin() AS v`))).v === true);
ok("les changements de politique sont journalisés", (await rows(asAs(ADMIN, `SELECT 1 FROM audit_log WHERE action = 'SETTING'`, [], aal2))).length === 2);
await db.query(`DELETE FROM auth.mfa_factors`);

done();
