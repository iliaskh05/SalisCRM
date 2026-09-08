import { COMPANY } from "@/lib/company";
import { calculateQuote } from "@/lib/quotes/calculate";
import type { DemoState } from "@/lib/demo/types";

export const DEMO_TODAY = "2026-09-08";
export const DEMO_NOW = "2026-09-08T10:15:00.000Z";
export const DEMO_STATE_VERSION = 6;
export const STORAGE_KEY = "saliscrm-demo-state-v6";

const svg = (bg: string, label: string, fg = "#e2e8f0") =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect fill="${bg}" width="100%" height="100%"/><text x="50%" y="48%" fill="${fg}" font-family="Arial" font-size="42" text-anchor="middle">${label}</text><text x="50%" y="58%" fill="${fg}" font-size="22" text-anchor="middle" opacity=".7">Données de démonstration</text></svg>`,
  )}`;

export function createInitialDemoState(): DemoState {
  const catalog = [
    { id: "svc-01", code: "EXT-FULL", label: "Nettoyage complet de l’extraction", description: "Hotte, filtres, conduits et moteur — prestation complète.", unit: "forfait", unitPriceHt: 890, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-02", code: "HOTTE", label: "Nettoyage de hotte", description: "Dégraissage et nettoyage de la hotte d’extraction.", unit: "forfait", unitPriceHt: 320, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-03", code: "FILTRE", label: "Nettoyage de filtres", description: "Dégraissage des filtres labyrinthes / inox.", unit: "unité", unitPriceHt: 18, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-04", code: "CONDUIT", label: "Nettoyage de conduits", description: "Curage et dégraissage des conduits d’extraction.", unit: "ml", unitPriceHt: 28, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-05", code: "MOTEUR", label: "Nettoyage ventilateur / moteur", description: "Intervention sur moteur, caisson et turbine.", unit: "forfait", unitPriceHt: 180, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-06", code: "DEGRAIS", label: "Dégraissage", description: "Traitement dégraissant des surfaces d’extraction.", unit: "forfait", unitPriceHt: 220, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-07", code: "DEEP", label: "Nettoyage en profondeur", description: "Prestation renforcée pour encrassement élevé.", unit: "forfait", unitPriceHt: 680, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-08", code: "SPEC", label: "Traitement spécialisé", description: "Traitement spécifique (inox, joints, zones difficiles).", unit: "forfait", unitPriceHt: 240, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-09", code: "TRAVEL", label: "Frais de déplacement", description: "Déplacement équipe sur site.", unit: "forfait", unitPriceHt: 45, vatRate: 20, kind: "travel" as const, suggested: true },
    { id: "svc-10", code: "NIGHT", label: "Majoration nuit", description: "Intervention entre 21h et 6h.", unit: "forfait", unitPriceHt: 150, vatRate: 20, kind: "night" as const, suggested: true },
    { id: "svc-11", code: "URG", label: "Majoration urgence", description: "Intervention prioritaire sous 24/48 h.", unit: "forfait", unitPriceHt: 220, vatRate: 20, kind: "emergency" as const, suggested: true },
    { id: "svc-12", code: "PREV", label: "Maintenance préventive", description: "Visite de contrôle et entretien préventif.", unit: "visite", unitPriceHt: 390, vatRate: 20, kind: "service" as const, suggested: true },
    { id: "svc-13", code: "CONTRACT", label: "Contrat de maintenance récurrent", description: "Forfait annuel d’entretien programmé.", unit: "an", unitPriceHt: 980, vatRate: 20, kind: "service" as const, suggested: true },
  ];

  const users = [
    { id: "u-sophie", name: "Imam Mahjoubi", email: "sophie@salis3hottes.fr", password: "demo2026", role: "admin" as const, status: "active" as const, requestedRole: "admin" as const },
    { id: "u-wael", name: "Wael", email: "wael@salis3hottes.fr", password: "demo2026", role: "commercial" as const, status: "active" as const, requestedRole: "commercial" as const },
    { id: "u-alix", name: "Alix", email: "alix@salis3hottes.fr", password: "demo2026", role: "commercial" as const, status: "active" as const, requestedRole: "commercial" as const },
    { id: "u-camille", name: "Camille", email: "camille@salis3hottes.fr", password: "demo2026", role: "commercial" as const, status: "active" as const, requestedRole: "commercial" as const },
    { id: "u-karim", name: "Karim Benali", email: "karim@salis3hottes.fr", password: "demo2026", role: "prestataire" as const, status: "active" as const, requestedRole: "prestataire" as const },
    { id: "u-lucas", name: "Lucas Martin", email: "lucas@salis3hottes.fr", password: "demo2026", role: "prestataire" as const, status: "active" as const, requestedRole: "prestataire" as const },
  ];

  const providers = [
    { id: "pr-01", userId: "u-karim", name: "Karim Benali", company: "Équipe Nord", phone: "06 18 44 21 09", email: "karim@salis3hottes.fr", city: "Paris", zone: "Paris" as const, specialty: "Nettoyage extraction", costRate: 280, status: "active" as const },
    { id: "pr-02", userId: "u-lucas", name: "Lucas Martin", company: "Équipe Est", phone: "06 72 19 55 40", email: "lucas@salis3hottes.fr", city: "Dijon", zone: "Dijon" as const, specialty: "Conduits & motorisation", costRate: 260, status: "active" as const },
    { id: "pr-03", userId: null, name: "Nadia El Idrissi", company: "Équipe Lyon", phone: "06 44 81 02 73", email: "nadia@salis3hottes.fr", city: "Lyon", zone: "Lyon" as const, specialty: "Dégraissage industriel", costRate: 270, status: "active" as const },
  ];

  const internal = {
    channel: "internal" as const,
    consent: false,
    urgency: "normal" as const,
    requestType: "ponctuelle",
    maintenanceFrequency: "a_determiner",
    lastCleaning: "",
    filterType: "Labyrinthe inox",
    ductPresent: true,
    ductLength: "",
    motorPresent: true,
    motorType: "",
    accessibility: "",
    soilLevel: "Moyen",
    nightIntervention: false,
    schedulePreference: "",
    preferredContact: "email",
    landingPage: "",
    photos: [] as { id: string; url: string; kind: "before" | "technical"; name: string }[],
    assignedUserId: null as string | null,
    quoteId: null as string | null,
    submittedAt: "2026-09-06T09:00:00.000Z",
  };

  const leads = [
    { id: "l-01", company: "Bistrot des Ternes", contact: "Camille Morel", phone: "01 84 80 25 18", email: "c.morel@bistrotdesternes.fr", address: "23 avenue des Ternes", postalCode: "75017", city: "Paris", zone: "Paris" as const, siren: "832 110 448", siret: "832 110 448 00021", businessType: "Restaurant", source: "Recommandation", status: "qualified" as const, value: 1240, note: "Ouverture cuisine prévue début octobre. Visite technique réalisée.", hoodType: "Hotte murale inox", hoodLength: "2,8 m", filterCount: 10, convertedClientId: null, ...internal },
    { id: "l-02", company: "Hôtel Rivoli Opéra", contact: "Julien Arnaud", phone: "01 42 61 46 22", email: "j.arnaud@rivoliopera.fr", address: "8 rue de Rivoli", postalCode: "75001", city: "Paris", zone: "Paris" as const, siren: "441 209 331", siret: "441 209 331 00018", businessType: "Hôtel", source: "website_form", status: "contacted" as const, value: 2860, note: "Demande de contrat annuel pour 2 cuisines.", hoodType: "Hotte centrale", hoodLength: "4,0 m", filterCount: 16, convertedClientId: null, ...internal, channel: "website" as const, consent: true, urgency: "prioritaire" as const, requestType: "contrat", maintenanceFrequency: "semestrielle", lastCleaning: "Il y a plus d’un an", filterType: "Labyrinthe inox", ductPresent: true, ductLength: "24 ml", motorPresent: true, motorType: "Caisson 2,2 kW", accessibility: "Toiture", soilLevel: "Moyen", nightIntervention: true, schedulePreference: "Nuit 22h–4h", landingPage: "/devis", photos: [{ id: "p-l02-1", url: svg("#1e293b", "Hotte cuisine 1"), kind: "before" as const, name: "cuisine-1.jpg" }, { id: "p-l02-2", url: svg("#334155", "Local moteur"), kind: "technical" as const, name: "moteur.jpg" }], submittedAt: "2026-09-07T16:40:00.000Z" },
    { id: "l-03", company: "La Table du Canal", contact: "Sofia Benali", phone: "06 18 42 75 91", email: "sofia@tableducanal.fr", address: "14 quai de la Loire", postalCode: "75019", city: "Paris", zone: "Paris" as const, siren: "798 334 102", siret: "798 334 102 00035", businessType: "Restaurant", source: "Salon Sirha", status: "quote_requested" as const, value: 1680, note: "Visite technique réalisée le 9 septembre.", hoodType: "Hotte murale", hoodLength: "3,1 m", filterCount: 12, convertedClientId: null, ...internal },
    { id: "l-04", company: "Café des Halles", contact: "Martin Leroy", phone: "03 80 45 91 02", email: "contact@cafedeshalles-dijon.fr", address: "5 rue des Forges", postalCode: "21000", city: "Dijon", zone: "Dijon" as const, siren: "521 884 019", siret: "521 884 019 00012", businessType: "Restaurant", source: "Appel entrant", status: "quote_sent" as const, value: 940, note: "Relance devis prévue vendredi.", hoodType: "Hotte murale", hoodLength: "2,2 m", filterCount: 8, convertedClientId: null, ...internal },
    { id: "l-05", company: "Le Zinc de Troyes", contact: "Nicolas Petit", phone: "03 25 77 31 69", email: "n.petit@lezinc-troyes.fr", address: "11 rue Émile Zola", postalCode: "10000", city: "Troyes", zone: "Troyes" as const, siren: "453 772 881", siret: "453 772 881 00029", businessType: "Restaurant", source: "Prospection", status: "contacted" as const, value: 1120, note: "En attente des plans de la cuisine.", hoodType: "Hotte murale", hoodLength: "2,6 m", filterCount: 9, convertedClientId: null, ...internal },
    { id: "l-06", company: "Maison Mistral", contact: "Chloé Richard", phone: "06 70 33 28 11", email: "chloe@maisonmistral.fr", address: "44 rue de la Roquette", postalCode: "75011", city: "Paris", zone: "Paris" as const, siren: "889 201 774", siret: "889 201 774 00014", businessType: "Restaurant", source: "Instagram", status: "new" as const, value: 760, note: "Une hotte centrale, ouverture récente.", hoodType: "Hotte centrale", hoodLength: "2,4 m", filterCount: 8, convertedClientId: null, ...internal },
    { id: "l-07", company: "Brasserie des Terreaux", contact: "Hugo Lambert", phone: "04 78 28 11 64", email: "h.lambert@terreaux-lyon.fr", address: "3 place des Terreaux", postalCode: "69001", city: "Lyon", zone: "Lyon" as const, siren: "394 118 552", siret: "394 118 552 00041", businessType: "Restaurant", source: "Partenaire", status: "qualified" as const, value: 2140, note: "Deux lignes d’extraction, intervention de nuit souhaitée.", hoodType: "Hotte inox 3,6 m", hoodLength: "3,6 m", filterCount: 14, convertedClientId: null, ...internal, nightIntervention: true },
    { id: "l-08", company: "Le Fournil Saint-Honoré", contact: "Léa Perrot", phone: "01 42 60 18 44", email: "lea@fournilsainthonore.fr", address: "12 rue Saint-Honoré", postalCode: "75001", city: "Paris", zone: "Paris" as const, siren: "901 442 118", siret: "901 442 118 00019", businessType: "Boulangerie", source: "website_form", status: "new" as const, value: 980, note: "Fournil avec extraction saturée. Intervention souhaitée avant le week-end.", hoodType: "Hotte murale boulangerie", hoodLength: "2,4 m", filterCount: 8, convertedClientId: null, ...internal, channel: "website" as const, consent: true, urgency: "critique" as const, requestType: "ponctuelle", lastCleaning: "Jamais fait depuis l’ouverture", filterType: "Labyrinthe", ductPresent: true, ductLength: "11 ml", motorPresent: true, motorType: "Moteur 0,75 kW", accessibility: "Cour intérieure", soilLevel: "Élevé", nightIntervention: false, schedulePreference: "Après 21h, hors service", landingPage: "/devis", photos: [{ id: "p-l08-1", url: svg("#292524", "Hotte fournil"), kind: "before" as const, name: "hotte-fournil.jpg" }, { id: "p-l08-2", url: svg("#44403c", "Filtres encrassés"), kind: "technical" as const, name: "filtres.jpg" }, { id: "p-l08-3", url: svg("#1c1917", "Conduit"), kind: "technical" as const, name: "conduit.jpg" }], submittedAt: "2026-09-08T09:42:00.000Z", assignedUserId: null },
    { id: "l-09", company: "Chicken Street Lyon", contact: "Yanis Khelifi", phone: "04 78 30 55 12", email: "yanis@chickenstreet-lyon.fr", address: "27 rue de la République", postalCode: "69002", city: "Lyon", zone: "Lyon" as const, siren: "844 201 339", siret: "844 201 339 00027", businessType: "Fast-food", source: "website_form", status: "contacted" as const, value: 1340, note: "Encrassement élevé, service continu. Créneau nuit uniquement.", hoodType: "Hotte murale fryer", hoodLength: "2,0 m", filterCount: 6, convertedClientId: null, ...internal, channel: "website" as const, consent: true, urgency: "prioritaire" as const, requestType: "entretien_periodique", maintenanceFrequency: "trimestrielle", lastCleaning: "Il y a 8 mois", filterType: "Labyrinthe", ductPresent: true, ductLength: "9 ml", motorPresent: true, motorType: "Moteur 1,1 kW", accessibility: "Toiture", soilLevel: "Élevé", nightIntervention: true, schedulePreference: "2h–5h", landingPage: "/devis", photos: [{ id: "p-l09-1", url: svg("#7c2d12", "Poste friture"), kind: "before" as const, name: "friture.jpg" }], submittedAt: "2026-09-07T11:18:00.000Z", assignedUserId: "u-sophie" },
    { id: "l-10", company: "Cuisine Centrale Villeurbanne", contact: "Nadia Cohen", phone: "04 72 65 40 08", email: "n.cohen@villeurbanne.fr", address: "4 place Wilson", postalCode: "69100", city: "Lyon", zone: "Lyon" as const, siren: "200 046 977", siret: "200 046 977 00014", businessType: "Cuisine collective", source: "website_form", status: "qualified" as const, value: 4200, note: "Marché public en cours. Deux lignes d’extraction, accès H24.", hoodType: "Hotte centrale collective", hoodLength: "6,2 m", filterCount: 24, convertedClientId: null, ...internal, channel: "website" as const, consent: true, urgency: "normal" as const, requestType: "contrat", maintenanceFrequency: "trimestrielle", lastCleaning: "Il y a 6 mois", filterType: "Inox", ductPresent: true, ductLength: "42 ml", motorPresent: true, motorType: "Caisson 3 kW", accessibility: "Local technique + toiture", soilLevel: "Moyen", nightIntervention: true, schedulePreference: "Nuit", landingPage: "/collectivites", photos: [{ id: "p-l10-1", url: svg("#0f766e", "Ligne 1"), kind: "before" as const, name: "ligne-1.jpg" }, { id: "p-l10-2", url: svg("#134e4a", "Ligne 2"), kind: "before" as const, name: "ligne-2.jpg" }], submittedAt: "2026-09-05T08:10:00.000Z", assignedUserId: "u-sophie" },
  ];

  const clients = [
    { id: "c-01", leadId: null, name: "Le Comptoir du Marais", contact: "Claire Dubois", email: "claire@comptoirdumarais.fr", city: "Paris", zone: "Paris" as const, address: "18 rue de Bretagne", postalCode: "75003", phone: "01 42 72 31 09", siren: "481 220 913", siret: "481 220 913 00027", businessType: "Restaurant", notes: "Client historique, interventions trimestrielles.", contract: "Sérénité trimestriel", since: "2022", commercialId: "u-wael" },
    { id: "c-02", leadId: null, name: "Hôtel des Arts", contact: "Romain Vidal", email: "r.vidal@hotelarts.fr", city: "Lyon", zone: "Lyon" as const, address: "9 rue de la République", postalCode: "69001", phone: "04 72 41 18 50", siren: "399 441 208", siret: "399 441 208 00033", businessType: "Hôtel-restaurant", notes: "Deux cuisines, accès toiture.", contract: "Conformité semestriel", since: "2023", commercialId: "u-camille" },
    { id: "c-03", leadId: null, name: "Brasserie Saint-Jean", contact: "Paul Lemoine", email: "direction@saintjeantroyes.fr", city: "Troyes", zone: "Troyes" as const, address: "4 place Saint-Jean", postalCode: "10000", phone: "03 25 73 04 12", siren: "421 773 664", siret: "421 773 664 00019", businessType: "Brasserie", notes: "Trois postes d’extraction.", contract: "Sérénité trimestriel", since: "2021", commercialId: "u-alix" },
    { id: "c-04", leadId: null, name: "Relais Gourmet", contact: "Marie Chevalier", email: "m.chevalier@relaisgourmet.fr", city: "Dijon", zone: "Dijon" as const, address: "26 rue Musette", postalCode: "21000", phone: "03 80 43 29 86", siren: "534 118 902", siret: "534 118 902 00022", businessType: "Restaurant", notes: "Cuisine ouverte, horaires matinaux.", contract: "Essentiel semestriel", since: "2024", commercialId: "u-alix" },
    { id: "c-05", leadId: null, name: "La Verrière Montmartre", contact: "Thomas Bernard", email: "thomas@laverierre.fr", city: "Paris", zone: "Paris" as const, address: "41 rue des Abbesses", postalCode: "75018", phone: "01 46 06 14 88", siren: "478 331 055", siret: "478 331 055 00044", businessType: "Restaurant", notes: "Cycle complet de démonstration déjà réalisé.", contract: "Sérénité trimestriel", since: "2020", commercialId: "u-wael" },
    { id: "c-06", leadId: null, name: "Maison Colette", contact: "Aïcha Martin", email: "a.martin@maisoncolette.fr", city: "Paris", zone: "Île-de-France" as const, address: "12 rue Saint-Dominique", postalCode: "75007", phone: "01 45 51 20 67", siren: "812 664 390", siret: "812 664 390 00016", businessType: "Restaurant gastronomique", notes: "Intervention de nuit préférée.", contract: "Conformité annuel", since: "2023", commercialId: "u-alix" },
    { id: "c-07", leadId: null, name: "Les Jardins de l’Aube", contact: "Émilie Fontaine", email: "contact@jardinsaube.fr", city: "Troyes", zone: "Troyes" as const, address: "8 quai Dampierre", postalCode: "10000", phone: "03 25 41 67 90", siren: "887 220 441", siret: "887 220 441 00028", businessType: "Restaurant", notes: "Premier contrat 2024.", contract: "Essentiel semestriel", since: "2024", commercialId: "u-wael" },
  ];

  const installations = [
    { id: "ins-01", clientId: "c-01", label: "Cuisine principale", hoodType: "Hotte inox murale", hoodLength: "3,2 m", filterCount: 12, filterType: "Labyrinthe inox", ductPresent: true, ductLength: "18 ml", ductAccessibility: "Plafond technique", motorPresent: true, motorType: "Moteur 1,5 kW toiture", motorAccessibility: "Toiture, échelle", soilLevel: "Moyen", nightIntervention: false, schedulePreferences: "6h00 – 10h00", remarks: "Accès cours intérieure." },
    { id: "ins-02", clientId: "c-01", label: "Poste grillades", hoodType: "Hotte murale", hoodLength: "1,8 m", filterCount: 6, filterType: "Labyrinthe", ductPresent: true, ductLength: "9 ml", ductAccessibility: "Bon", motorPresent: true, motorType: "Moteur 0,75 kW", motorAccessibility: "Local technique", soilLevel: "Élevé", nightIntervention: false, schedulePreferences: "Matin", remarks: "" },
    { id: "ins-03", clientId: "c-02", label: "Cuisine restaurant", hoodType: "Hotte centrale", hoodLength: "4,0 m", filterCount: 16, filterType: "Inox", ductPresent: true, ductLength: "24 ml", ductAccessibility: "Calorifugé, toiture", motorPresent: true, motorType: "Moteur 2,2 kW", motorAccessibility: "Toiture", soilLevel: "Moyen", nightIntervention: true, schedulePreferences: "Nuit 22h–4h", remarks: "Hôtel en activité." },
    { id: "ins-04", clientId: "c-03", label: "Cuisine brasserie", hoodType: "Hotte inox", hoodLength: "3,8 m", filterCount: 14, filterType: "Labyrinthe", ductPresent: true, ductLength: "31 ml", ductAccessibility: "Moyen", motorPresent: true, motorType: "Caisson 2,2 kW", motorAccessibility: "Toiture", soilLevel: "Élevé", nightIntervention: false, schedulePreferences: "5h45 – 11h", remarks: "" },
    { id: "ins-05", clientId: "c-04", label: "Cuisine ouverte", hoodType: "Hotte design", hoodLength: "2,4 m", filterCount: 8, filterType: "Labyrinthe", ductPresent: true, ductLength: "14 ml", ductAccessibility: "Bon", motorPresent: true, motorType: "Moteur 1,1 kW", motorAccessibility: "Local", soilLevel: "Faible", nightIntervention: false, schedulePreferences: "7h15", remarks: "Salle ouverte sur cuisine." },
    { id: "ins-06", clientId: "c-05", label: "Cuisine principale", hoodType: "Hotte centrale", hoodLength: "3,5 m", filterCount: 14, filterType: "Inox", ductPresent: true, ductLength: "22 ml", ductAccessibility: "Toiture", motorPresent: true, motorType: "Caisson 1,5 kW", motorAccessibility: "Toiture", soilLevel: "Moyen", nightIntervention: true, schedulePreferences: "6h00", remarks: "Accès monte-charge." },
    { id: "ins-07", clientId: "c-06", label: "Cuisine gastronomique", hoodType: "Hotte murale inox", hoodLength: "2,6 m", filterCount: 10, filterType: "Labyrinthe", ductPresent: true, ductLength: "16 ml", ductAccessibility: "Bon", motorPresent: true, motorType: "Moteur 1,1 kW", motorAccessibility: "Toiture", soilLevel: "Faible", nightIntervention: true, schedulePreferences: "Nuit", remarks: "" },
    { id: "ins-08", clientId: "c-07", label: "Cuisine principale", hoodType: "Hotte murale", hoodLength: "2,2 m", filterCount: 8, filterType: "Labyrinthe", ductPresent: true, ductLength: "12 ml", ductAccessibility: "Bon", motorPresent: true, motorType: "Moteur 0,75 kW", motorAccessibility: "Local", soilLevel: "Moyen", nightIntervention: false, schedulePreferences: "7h30", remarks: "" },
  ];

  const quoteLines = [
    { id: "ql-041-1", quoteId: "q-041", catalogId: "svc-02", label: "Nettoyage de hotte", description: "Hotte 3,2 m", unit: "forfait", quantity: 1, unitPriceHt: 320, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-041-2", quoteId: "q-041", catalogId: "svc-04", label: "Nettoyage de conduits", description: "18 ml", unit: "ml", quantity: 18, unitPriceHt: 28, vatRate: 20, kind: "service" as const, position: 1 },
    { id: "ql-041-3", quoteId: "q-041", catalogId: "svc-09", label: "Frais de déplacement", description: "", unit: "forfait", quantity: 1, unitPriceHt: 45, vatRate: 20, kind: "travel" as const, position: 2 },
    { id: "ql-042-1", quoteId: "q-042", catalogId: "svc-02", label: "Nettoyage de hotte", description: "Cuisine ouverte", unit: "forfait", quantity: 1, unitPriceHt: 320, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-042-2", quoteId: "q-042", catalogId: "svc-03", label: "Nettoyage de filtres", description: "", unit: "unité", quantity: 8, unitPriceHt: 18, vatRate: 20, kind: "service" as const, position: 1 },
    { id: "ql-043-1", quoteId: "q-043", catalogId: "svc-01", label: "Nettoyage complet de l’extraction", description: "3 postes", unit: "forfait", quantity: 1, unitPriceHt: 890, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-043-2", quoteId: "q-043", catalogId: "svc-05", label: "Nettoyage ventilateur / moteur", description: "", unit: "forfait", quantity: 1, unitPriceHt: 180, vatRate: 20, kind: "service" as const, position: 1 },
    { id: "ql-044-1", quoteId: "q-044", catalogId: "svc-01", label: "Nettoyage complet de l’extraction", description: "2 cuisines", unit: "forfait", quantity: 2, unitPriceHt: 890, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-045-1", quoteId: "q-045", catalogId: "svc-12", label: "Maintenance préventive", description: "Audit + nettoyage hotte", unit: "visite", quantity: 1, unitPriceHt: 390, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-046-1", quoteId: "q-046", catalogId: "svc-01", label: "Nettoyage complet de l’extraction", description: "Cuisine principale", unit: "forfait", quantity: 1, unitPriceHt: 890, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-046-2", quoteId: "q-046", catalogId: "svc-04", label: "Nettoyage de conduits", description: "22 ml", unit: "ml", quantity: 22, unitPriceHt: 28, vatRate: 20, kind: "service" as const, position: 1 },
    { id: "ql-047-1", quoteId: "q-047", catalogId: "svc-12", label: "Maintenance préventive", description: "Cuisine principale", unit: "visite", quantity: 1, unitPriceHt: 390, vatRate: 20, kind: "service" as const, position: 0 },
    { id: "ql-047-2", quoteId: "q-047", catalogId: "svc-09", label: "Frais de déplacement", description: "", unit: "forfait", quantity: 1, unitPriceHt: 45, vatRate: 20, kind: "travel" as const, position: 1 },
  ];

  const mkQuote = (
    id: string,
    reference: string,
    clientId: string,
    installationId: string,
    status: DemoState["quotes"][number]["status"],
    issuedAt: string,
    validUntil: string,
    extra: Partial<DemoState["quotes"][number]> = {},
  ) => {
    const lines = quoteLines.filter((l) => l.quoteId === id);
    const totals = calculateQuote(lines.map((l) => ({ quantity: l.quantity, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate, label: l.label })));
    void totals;
    return {
      id,
      reference,
      clientId,
      leadId: extra.leadId ?? null,
      installationId,
      commercialId: extra.commercialId ?? "u-wael",
      status,
      issuedAt,
      validUntil,
      notes: "Prestation réalisée selon protocole Salis 3 Hottes. Rapport photo remis en fin d’intervention.",
      paymentTerms: COMPANY.paymentTermsDefault,
      discountHt: 0,
      depositAmount: 0,
      interventionId: null as string | null,
      invoiceId: null as string | null,
      createdAt: `${issuedAt}T09:00:00.000Z`,
      ...extra,
    };
  };

  const quotes = [
    mkQuote("q-041", "D-2026-041", "c-01", "ins-01", "accepted", "2026-09-02", "2026-10-02", { interventionId: "int-01", commercialId: "u-wael" }),
    mkQuote("q-042", "D-2026-042", "c-04", "ins-05", "accepted", "2026-09-04", "2026-10-04", { commercialId: "u-alix" }),
    mkQuote("q-043", "D-2026-043", "c-03", "ins-04", "accepted", "2026-09-08", "2026-10-08", { interventionId: "int-03", commercialId: "u-alix" }),
    mkQuote("q-044", "D-2026-044", "c-02", "ins-03", "accepted", "2026-09-10", "2026-10-10", { commercialId: "u-camille" }),
    mkQuote("q-045", "D-2026-045", "c-06", "ins-07", "sent", "2026-09-11", "2026-10-11", { commercialId: "u-alix" }),
    mkQuote("q-046", "D-2026-046", "c-05", "ins-06", "converted_invoice", "2026-08-28", "2026-09-27", { interventionId: "int-05", invoiceId: "inv-118", commercialId: "u-wael" }),
    mkQuote("q-047", "D-2026-047", "c-07", "ins-08", "accepted", "2026-09-01", "2026-10-01", { commercialId: "u-wael" }),
  ];

  const interventions = [
    { id: "int-01", reference: "INT-2026-041", clientId: "c-01", installationId: "ins-01", quoteId: "q-041", providerId: "pr-01", city: "Paris", address: "18 rue de Bretagne, 75003 Paris", date: "2026-09-16", startTime: "06:30", endTime: "10:30", service: "Nettoyage complet — cuisine principale", status: "planned" as const, amountTtc: 0, description: "Hotte 3,2 m + 18 ml de conduits.", notes: "Accès cours intérieure.", invoiceId: null as string | null },
    { id: "int-02", reference: "INT-2026-044", clientId: "c-02", installationId: "ins-03", quoteId: "q-044", providerId: "pr-03", city: "Lyon", address: "9 rue de la République, 69001 Lyon", date: "2026-09-18", startTime: "22:00", endTime: "04:00", service: "Dégraissage hottes & conduits", status: "confirmed" as const, amountTtc: 0, description: "Deux cuisines, intervention de nuit.", notes: "Hôtel en activité.", invoiceId: null },
    { id: "int-03", reference: "INT-2026-043", clientId: "c-03", installationId: "ins-04", quoteId: "q-043", providerId: "pr-02", city: "Troyes", address: "4 place Saint-Jean, 10000 Troyes", date: "2026-09-23", startTime: "05:45", endTime: "10:45", service: "Entretien trimestriel", status: "planned" as const, amountTtc: 0, description: "Trois postes d’extraction.", notes: "", invoiceId: null },
    { id: "int-04", reference: "INT-2026-040", clientId: "c-04", installationId: "ins-05", quoteId: "q-042", providerId: "pr-02", city: "Dijon", address: "26 rue Musette, 21000 Dijon", date: "2026-09-09", startTime: "07:15", endTime: "10:15", service: "Nettoyage hotte cuisine ouverte", status: "report_validated" as const, amountTtc: 0, description: "Hotte design 2,4 m.", notes: "", invoiceId: "inv-119" },
    { id: "int-05", reference: "INT-2026-038", clientId: "c-05", installationId: "ins-06", quoteId: "q-046", providerId: "pr-01", city: "Paris", address: "41 rue des Abbesses, 75018 Paris", date: "2026-09-05", startTime: "06:00", endTime: "13:00", service: "Nettoyage annuel des conduits", status: "closed" as const, amountTtc: 0, description: "Cycle complet réalisé.", notes: "", invoiceId: "inv-118" },
    { id: "int-06", reference: "INT-2026-047", clientId: "c-06", installationId: "ins-07", quoteId: "q-045", providerId: "pr-01", city: "Paris", address: "12 rue Saint-Dominique, 75007 Paris", date: "2026-09-26", startTime: "06:30", endTime: "09:30", service: "Contrôle conformité extraction", status: "to_plan" as const, amountTtc: 0, description: "Audit + nettoyage.", notes: "", invoiceId: null },
    { id: "int-07", reference: "INT-2026-036", clientId: "c-07", installationId: "ins-08", quoteId: null, providerId: "pr-02", city: "Troyes", address: "8 quai Dampierre, 10000 Troyes", date: "2026-09-02", startTime: "07:30", endTime: "10:30", service: "Entretien semestriel", status: "closed" as const, amountTtc: 0, description: "", notes: "", invoiceId: null },
  ];

  const fillAmounts = (list: typeof interventions) =>
    list.map((item) => {
      const q = quotes.find((x) => x.id === item.quoteId);
      const lines = quoteLines.filter((l) => l.quoteId === item.quoteId);
      const totals = q
        ? calculateQuote(
            lines.map((l) => ({ quantity: l.quantity, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate, label: l.label })),
            { discountHt: q.discountHt, depositAmount: q.depositAmount },
          )
        : { totalTtc: item.amountTtc };
      return { ...item, amountTtc: totals.totalTtc || 756 };
    });

  const photos = [
    { id: "ph-01", interventionId: "int-05", clientId: "c-05", kind: "before" as const, url: svg("#3f2e1f", "AVANT — hotte encrassée", "#fde68a"), comment: "Hotte avant intervention", uploader: "Karim Benali", createdAt: "2026-09-05T06:12:00.000Z" },
    { id: "ph-02", interventionId: "int-05", clientId: "c-05", kind: "after" as const, url: svg("#e8eef2", "APRÈS — hotte nettoyée", "#0f766e"), comment: "Hotte après dégraissage", uploader: "Karim Benali", createdAt: "2026-09-05T12:40:00.000Z" },
    { id: "ph-03", interventionId: "int-05", clientId: "c-05", kind: "technical" as const, url: svg("#1e293b", "TECHNIQUE — moteur", "#94a3b8"), comment: "Caisson toiture", uploader: "Karim Benali", createdAt: "2026-09-05T12:48:00.000Z" },
    { id: "ph-04", interventionId: "int-04", clientId: "c-04", kind: "before" as const, url: svg("#4a3728", "AVANT — filtres", "#fbbf24"), comment: "Filtres avant", uploader: "Lucas Martin", createdAt: "2026-09-09T07:20:00.000Z" },
    { id: "ph-05", interventionId: "int-04", clientId: "c-04", kind: "after" as const, url: svg("#f1f5f9", "APRÈS — filtres", "#0f766e"), comment: "Filtres après", uploader: "Lucas Martin", createdAt: "2026-09-09T10:05:00.000Z" },
  ];

  const products = [
    { id: "prod-01", interventionId: "int-05", name: "Dégraissant alcalin", category: "Dégraissant", quantity: 4, unit: "L", unitCost: 8.4, notes: "Application hotte + conduits" },
    { id: "prod-02", interventionId: "int-05", name: "Nettoyant inox", category: "Inox", quantity: 1, unit: "L", unitCost: 12.5, notes: "" },
    { id: "prod-03", interventionId: "int-04", name: "Dégraissant filtres", category: "Dégraissant", quantity: 2, unit: "L", unitCost: 8.4, notes: "" },
  ];

  const reports = [
    {
      id: "rep-05",
      interventionId: "int-05",
      workCompleted: "Nettoyage complet de la hotte centrale, des 14 filtres, de 22 ml de conduits et contrôle du caisson toiture.",
      observations: "Encrassement moyen, conforme au cycle annuel.",
      difficulties: "Accès toiture par échelle — sécurisation de la zone effectuée.",
      recommendations: "Maintenir le rythme trimestriel. Vérifier les joints du caisson au prochain passage.",
      checklist: { hood: true, filters: true, ducts: true, motor: true, grease: true, access: true, area: true },
      providerSignature: "Karim Benali",
      clientSignature: "Thomas Bernard",
      validatedAt: "2026-09-05T13:10:00.000Z",
    },
    {
      id: "rep-04",
      interventionId: "int-04",
      workCompleted: "Nettoyage hotte cuisine ouverte et 8 filtres.",
      observations: "Encrassement faible à moyen.",
      difficulties: "Aucune.",
      recommendations: "Passage semestriel suffisant.",
      checklist: { hood: true, filters: true, ducts: false, motor: true, grease: true, access: true, area: true },
      providerSignature: "Lucas Martin",
      clientSignature: "Marie Chevalier",
      validatedAt: "2026-09-09T10:20:00.000Z",
    },
  ];

  const invoiceLines = quoteLines
    .filter((l) => l.quoteId === "q-046" || l.quoteId === "q-042")
    .map((l, i) => ({
      id: `il-${l.id}`,
      invoiceId: l.quoteId === "q-046" ? "inv-118" : "inv-119",
      label: l.label,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
      vatRate: l.vatRate,
      position: i,
    }));

  const extraInvLines = [
    { id: "il-115-1", invoiceId: "inv-115", label: "Entretien extraction — août", description: "3 postes", unit: "forfait", quantity: 1, unitPriceHt: 1816.67, vatRate: 20, position: 0 },
    { id: "il-116-1", invoiceId: "inv-116", label: "Entretien trimestriel", description: "Cuisine principale", unit: "forfait", quantity: 1, unitPriceHt: 950, vatRate: 20, position: 0 },
  ];

  const invoices = [
    { id: "inv-118", number: "F-2026-118", clientId: "c-05", quoteId: "q-046", interventionId: "int-05", issuedAt: "2026-09-05", dueAt: "2026-10-05", notes: "Facture émise après validation du rapport.", paymentTerms: COMPANY.paymentTermsDefault, eStatus: "ready" as const, cancelled: false },
    { id: "inv-119", number: "F-2026-119", clientId: "c-04", quoteId: "q-042", interventionId: "int-04", issuedAt: "2026-09-09", dueAt: "2026-10-09", notes: "", paymentTerms: COMPANY.paymentTermsDefault, eStatus: "ready" as const, cancelled: false },
    { id: "inv-115", number: "F-2026-115", clientId: "c-03", quoteId: null, interventionId: null, issuedAt: "2026-08-18", dueAt: "2026-09-17", notes: "Relance à effectuer.", paymentTerms: COMPANY.paymentTermsDefault, eStatus: "ready" as const, cancelled: false },
    { id: "inv-116", number: "F-2026-116", clientId: "c-01", quoteId: "q-041", interventionId: null, issuedAt: "2026-08-22", dueAt: "2026-09-21", notes: "", paymentTerms: COMPANY.paymentTermsDefault, eStatus: "ready" as const, cancelled: false },
  ];

  const payments = [
    { id: "pay-01", invoiceId: "inv-118", clientId: "c-05", amount: 1809.6, paidAt: "2026-09-08", method: "transfer" as const, reference: "VIR-VER-0809", note: "Solde" },
    { id: "pay-02", invoiceId: "inv-119", clientId: "c-04", amount: 400, paidAt: "2026-09-10", method: "card" as const, reference: "CB-119", note: "Acompte" },
  ];

  const activities = [
    { id: "act-01", clientId: "c-05", leadId: null, type: "QUOTE_CREATED", title: "Devis D-2026-046 créé", description: "Nettoyage annuel des conduits", createdAt: "2026-08-28T09:12:00.000Z" },
    { id: "act-02", clientId: "c-05", leadId: null, type: "QUOTE_SENT", title: "Devis D-2026-046 envoyé", description: "", createdAt: "2026-08-28T11:02:00.000Z" },
    { id: "act-03", clientId: "c-05", leadId: null, type: "QUOTE_ACCEPTED", title: "Devis D-2026-046 accepté", description: "", createdAt: "2026-08-30T16:40:00.000Z" },
    { id: "act-04", clientId: "c-05", leadId: null, type: "INTERVENTION_CREATED", title: "Intervention INT-2026-038 planifiée", description: "5 septembre · Karim Benali", createdAt: "2026-08-30T16:48:00.000Z" },
    { id: "act-05", clientId: "c-05", leadId: null, type: "PHOTO_UPLOADED", title: "Photos avant ajoutées", description: "", createdAt: "2026-09-05T06:12:00.000Z" },
    { id: "act-06", clientId: "c-05", leadId: null, type: "INTERVENTION_COMPLETED", title: "Intervention terminée", description: "", createdAt: "2026-09-05T13:00:00.000Z" },
    { id: "act-07", clientId: "c-05", leadId: null, type: "PHOTO_UPLOADED", title: "Photos après ajoutées", description: "", createdAt: "2026-09-05T12:40:00.000Z" },
    { id: "act-08", clientId: "c-05", leadId: null, type: "REPORT_VALIDATED", title: "Rapport validé et signé", description: "Client : Thomas Bernard", createdAt: "2026-09-05T13:10:00.000Z" },
    { id: "act-09", clientId: "c-05", leadId: null, type: "INVOICE_CREATED", title: "Facture F-2026-118 créée", description: "", createdAt: "2026-09-05T14:00:00.000Z" },
    { id: "act-10", clientId: "c-05", leadId: null, type: "PAYMENT_RECEIVED", title: "Paiement reçu — 1 809,60 €", description: "Virement", createdAt: "2026-09-08T09:25:00.000Z" },
    { id: "act-11", clientId: "c-01", leadId: null, type: "QUOTE_ACCEPTED", title: "Devis D-2026-041 accepté", description: "", createdAt: "2026-09-03T10:00:00.000Z" },
    { id: "act-12", clientId: null, leadId: "l-01", type: "NOTE_ADDED", title: "Qualification Bistrot des Ternes", description: "Visite technique réalisée", createdAt: "2026-09-07T15:20:00.000Z" },
  ];

  const documents = [
    { id: "doc-01", clientId: "c-05", title: "Devis D-2026-046", type: "quote" as const, date: "2026-08-28", uploader: "Imam Mahjoubi", size: "86 Ko", url: "#" },
    { id: "doc-02", clientId: "c-05", title: "Rapport INT-2026-038", type: "report" as const, date: "2026-09-05", uploader: "Karim Benali", size: "124 Ko", url: "#" },
    { id: "doc-03", clientId: "c-05", title: "Facture F-2026-118", type: "invoice" as const, date: "2026-09-05", uploader: "Imam Mahjoubi", size: "74 Ko", url: "#" },
    { id: "doc-04", clientId: "c-01", title: "Contrat Sérénité 2026", type: "contract" as const, date: "2026-01-12", uploader: "Imam Mahjoubi", size: "210 Ko", url: "#" },
  ];

  const conversations = [
    { id: "cv-01", title: "Imam × Karim", kind: "direct" as const, interventionId: null, memberIds: ["u-sophie", "u-karim"] },
    { id: "cv-02", title: "Équipe terrain", kind: "group" as const, interventionId: null, memberIds: ["u-sophie", "u-karim", "u-lucas"] },
    { id: "cv-03", title: "INT-2026-041 — Comptoir du Marais", kind: "intervention" as const, interventionId: "int-01", memberIds: ["u-sophie", "u-karim"] },
  ];

  const messages = [
    { id: "msg-01", conversationId: "cv-03", authorId: "u-sophie", body: "Le client souhaite une intervention à 6h30. Accès par la cour.", kind: "text" as const, createdAt: "2026-09-07T17:12:00.000Z", readBy: ["u-sophie", "u-karim"] },
    { id: "msg-02", conversationId: "cv-03", authorId: "u-karim", body: "Confirmé. Moteur accessible par la toiture ?", kind: "text" as const, createdAt: "2026-09-07T17:18:00.000Z", readBy: ["u-sophie", "u-karim"] },
    { id: "msg-03", conversationId: "cv-03", authorId: "u-sophie", body: "Oui, échelle dans le local poubelles. Merci.", kind: "text" as const, createdAt: "2026-09-07T17:21:00.000Z", readBy: ["u-sophie"] },
    { id: "msg-04", conversationId: "cv-01", authorId: "u-karim", body: "Rapport Verrière validé. Photos avant/après déposées.", kind: "text" as const, createdAt: "2026-09-05T13:22:00.000Z", readBy: ["u-karim"] },
  ];

  const notifications = [
    { id: "n-00", title: "Nouvelle demande de devis", body: "Le Fournil Saint-Honoré — formulaire site · urgence critique", href: "/demandes-devis/l-08", createdAt: "2026-09-08T09:42:00.000Z", read: false, role: "admin" as const },
    { id: "n-01", title: "Devis accepté", body: "D-2026-041 — Le Comptoir du Marais", href: "/devis/q-041", createdAt: "2026-09-03T10:00:00.000Z", read: true, role: "admin" as const },
    { id: "n-02", title: "Intervention demain", body: "Comptoir du Marais — 16 sept. 06:30", href: "/interventions/int-01", createdAt: "2026-09-08T08:00:00.000Z", read: false, role: "all" as const },
    { id: "n-03", title: "Facture en retard", body: "F-2026-115 — Brasserie Saint-Jean", href: "/factures/inv-115", createdAt: "2026-09-18T08:00:00.000Z", read: false, role: "admin" as const },
    { id: "n-04", title: "Nouveau message", body: "Karim a répondu sur INT-2026-041", href: "/chat", createdAt: "2026-09-07T17:18:00.000Z", read: false, role: "admin" as const },
    { id: "n-05", title: "Mission assignée", body: "Comptoir du Marais — 16 sept.", href: "/interventions/int-01", createdAt: "2026-09-03T10:10:00.000Z", read: false, role: "prestataire" as const },
  ];

  return {
    version: DEMO_STATE_VERSION,
    sessionUserId: "u-sophie",
    remember: true,
    users,
    leads,
    clients,
    installations,
    catalog,
    quotes,
    quoteLines,
    providers,
    interventions: fillAmounts(interventions),
    photos,
    products,
    reports,
    invoices,
    invoiceLines: [...invoiceLines, ...extraInvLines],
    payments,
    activities,
    documents,
    conversations,
    messages,
    notifications,
    settings: {
      quoteValidityDays: 30,
      defaultVat: 20,
      paymentTerms: COMPANY.paymentTermsDefault,
      quotePrefix: "D",
      invoicePrefix: "F",
    },
    quoteSeq: 48,
    invoiceSeq: 120,
    interventionSeq: 48,
  };
}
