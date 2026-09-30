// Tests opérations transactionnelles : conversion lead, devis → intervention, rapport.
// Lancer : npm run test:db
import { createTestDb, USERS } from "./_harness.mjs";

const { as, ok, rejects, done, asAdmin, asComm, asSuper } = await createTestDb();
const { PRESTA, PRESTA2 } = USERS;
const asPresta = (s, p) => as("authenticated", PRESTA, s, p);
const asPresta2 = (s, p) => as("authenticated", PRESTA2, s, p);
const one = async (p) => (await p).rows[0];

console.log("\n# Lead → client");
const lead = await one(asSuper(`
  INSERT INTO leads (email, company_name, contact_name, city, hood_length, filter_count, duct_present, message)
  VALUES ('Chef@Bistro.fr', 'Bistro du Coin', 'Paul', 'Lyon', '3 m', 4, true, 'Hotte encrassée') RETURNING id`));
const r1 = (await one(asComm(`SELECT convert_lead_to_client($1) AS r`, [lead.id]))).r;
ok("client + installation créés", r1.created === true && r1.client_id && r1.installation_id);
const cli = await one(asSuper(`SELECT company_name, reference, lead_id FROM clients WHERE id = $1`, [r1.client_id]));
ok("client rempli depuis la demande (réf. CLI-)", cli.company_name === "Bistro du Coin" && /^CLI-/.test(cli.reference) && cli.lead_id === lead.id);
const inst = await one(asSuper(`SELECT hood_length, filter_count, duct_present, remarks FROM client_installations WHERE id = $1`, [r1.installation_id]));
ok("installation reprise de la demande", inst.hood_length === "3 m" && inst.filter_count === 4 && inst.duct_present === true);
const r2 = (await one(asComm(`SELECT convert_lead_to_client($1, true) AS r`, [lead.id]))).r;
ok("reconversion : même client, rien de dupliqué", r2.client_id === r1.client_id && r2.created === false && r2.installation_id === r1.installation_id);
ok("lead marqué gagné", (await one(asSuper(`SELECT status FROM leads WHERE id=$1`, [lead.id]))).status === "won");

const lead2 = await one(asSuper(`INSERT INTO leads (email, company_name) VALUES ('  chef@bistro.FR ', 'Autre nom') RETURNING id`));
ok("doublon par e-mail (casse/espaces ignorés)", (await one(asComm(`SELECT convert_lead_to_client($1) AS r`, [lead2.id]))).r.client_id === r1.client_id);
const lead3 = await one(asSuper(`INSERT INTO leads (email, company_name) VALUES ('c_d@x.fr', 'Bis%') RETURNING id`));
const r3 = (await one(asComm(`SELECT convert_lead_to_client($1) AS r`, [lead3.id]))).r;
ok("« _ » et « % » ne sont plus des jokers", r3.created === true && r3.client_id !== r1.client_id);
await rejects("prestataire ne convertit pas", () => asPresta(`SELECT convert_lead_to_client($1)`, [lead.id]), "Accès refusé");

console.log("\n# Devis → intervention");
const lines = JSON.stringify([
  { label: "Dégraissage hotte", quantity: 1, unit_price_ht: 400, vat_rate: 20 },
  { label: "Filtres", quantity: 4, unit_price_ht: 25, vat_rate: 20 },
]);
await asComm(`UPDATE clients SET address = '3 rue Neuve', postal_code = '69001' WHERE id = $1`, [r1.client_id]);
const qid = (await one(asComm(`SELECT create_quote($1, $2::jsonb, p_installation_id => $3, p_discount_ht => 50) AS id`, [r1.client_id, lines, r1.installation_id]))).id;
const iid = (await one(asComm(`SELECT create_intervention_from_quote($1) AS id`, [qid]))).id;
const it = await one(asSuper(`SELECT * FROM interventions WHERE id = $1`, [iid]));
ok("prix = HT remisé (500 − 50)", Number(it.price_ht) === 450, it.price_ht);
ok("devis, installation et adresse repris", it.quote_id === qid && it.installation_id === r1.installation_id && it.address === "3 rue Neuve, 69001 Lyon", it.address);
ok("libellés repris", it.service_type === "Dégraissage hotte" && it.description === "Dégraissage hotte · Filtres");
const q = await one(asSuper(`SELECT status, converted_intervention_id FROM quotes WHERE id = $1`, [qid]));
ok("devis accepté et lié à l'intervention", q.status === "accepted" && q.converted_intervention_id === iid);
await rejects("pas de seconde intervention pour le même devis", () => asComm(`SELECT create_intervention_from_quote($1)`, [qid]), "existe déjà");
const qRejected = (await one(asComm(`SELECT create_quote($1, $2::jsonb) AS id`, [r1.client_id, lines]))).id;
await asComm(`UPDATE quotes SET status = 'rejected' WHERE id = $1`, [qRejected]);
await rejects("devis refusé : pas d'intervention", () => asComm(`SELECT create_intervention_from_quote($1)`, [qRejected]), "refusé");

console.log("\n# Rapport d'intervention");
const [p1] = (await asAdmin(`INSERT INTO providers (name) VALUES ('Presta Un') RETURNING id`)).rows;
await asAdmin(`SELECT grant_staff_access($1, 'prestataire', null, $2)`, [PRESTA, p1.id]);
await asComm(`UPDATE interventions SET provider_id = $2, status = 'planned', notes = 'Code portail 1234' WHERE id = $1`, [iid, p1.id]);
await asPresta(`SELECT save_intervention_report($1, 'Hotte dégraissée', 'RAS')`, [iid]);
const draft = await one(asSuper(`SELECT work_completed, validated_at FROM intervention_reports WHERE intervention_id = $1`, [iid]));
ok("brouillon enregistré par le prestataire", draft.work_completed === "Hotte dégraissée" && draft.validated_at === null);
ok("les notes de l'intervention ne sont plus écrasées", (await one(asSuper(`SELECT notes FROM interventions WHERE id=$1`, [iid]))).notes === "Code portail 1234");
await rejects("validation sans signatures refusée", () => asPresta(`SELECT save_intervention_report($1, 'Hotte dégraissée', p_validate => true)`, [iid]), "signature");
await rejects("autre prestataire refusé", () => asPresta2(`SELECT save_intervention_report($1, 'x')`, [iid]), "Accès refusé");
await asPresta(`SELECT save_intervention_report($1, 'Hotte dégraissée', 'RAS', p_provider_signature => 'P. Presta', p_client_signature => 'Paul', p_validate => true)`, [iid]);
const done_ = await one(asSuper(`SELECT i.status, i.completed_at, r.validated_at FROM interventions i JOIN intervention_reports r ON r.intervention_id = i.id WHERE i.id = $1`, [iid]));
ok("validation = intervention terminée", done_.status === "completed" && done_.completed_at && done_.validated_at);
await rejects("rapport validé verrouillé pour le prestataire", () => asPresta(`SELECT save_intervention_report($1, 'modifié')`, [iid]), "validé");
await rejects("… et pour le commercial", () => asComm(`SELECT save_intervention_report($1, 'modifié')`, [iid]), "validé");
await asAdmin(`SELECT save_intervention_report($1, 'Corrigé par la direction', p_provider_signature => 'P. Presta', p_client_signature => 'Paul')`, [iid]);
const fixed = await one(asSuper(`SELECT work_completed, validated_at FROM intervention_reports WHERE intervention_id = $1`, [iid]));
ok("la direction peut corriger, la validation reste", fixed.work_completed === "Corrigé par la direction" && fixed.validated_at);
ok("activité « terminée » journalisée une fois", (await asSuper(`SELECT 1 FROM activities WHERE activity_type = 'INTERVENTION_COMPLETED'`)).rows.length === 1);

done();
