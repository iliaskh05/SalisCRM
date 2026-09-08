export type LeadStatus = "new" | "contacted" | "qualified" | "quote_sent" | "won";
export type WorkStatus = "planned" | "completed";
export type InvoiceStatus = "paid" | "partial" | "overdue";

export const leads = [
  { id: "l-01", company: "Bistrot des Ternes", contact: "Camille Morel", city: "Paris 17e", phone: "01 84 80 25 18", status: "new" as LeadStatus, source: "Recommandation", value: 1240, note: "Ouverture cuisine prévue début octobre." },
  { id: "l-02", company: "Hôtel Rivoli Opéra", contact: "Julien Arnaud", city: "Paris 1er", phone: "01 42 61 46 22", status: "contacted" as LeadStatus, source: "Site web", value: 2860, note: "Demande de contrat annuel pour 2 cuisines." },
  { id: "l-03", company: "La Table du Canal", contact: "Sofia Benali", city: "Paris 19e", phone: "06 18 42 75 91", status: "qualified" as LeadStatus, source: "Salon Sirha", value: 1680, note: "Visite technique réalisée le 9 septembre." },
  { id: "l-04", company: "Café des Halles", contact: "Martin Leroy", city: "Dijon", phone: "03 80 45 91 02", status: "quote_sent" as LeadStatus, source: "Appel entrant", value: 940, note: "Relance devis prévue vendredi." },
  { id: "l-05", company: "Auberge Catalane", contact: "Élodie Ferrer", city: "Perpignan", phone: "04 68 62 09 45", status: "won" as LeadStatus, source: "Parrainage", value: 2140, note: "Contrat signé — première intervention le 23/09." },
  { id: "l-06", company: "Le Zinc de Troyes", contact: "Nicolas Petit", city: "Troyes", phone: "03 25 77 31 69", status: "contacted" as LeadStatus, source: "Prospection", value: 1120, note: "En attente des plans de la cuisine." },
  { id: "l-07", company: "Maison Mistral", contact: "Chloé Richard", city: "Paris 11e", phone: "06 70 33 28 11", status: "new" as LeadStatus, source: "Instagram", value: 760, note: "Restaurant végétal, une hotte centrale." },
  { id: "l-08", company: "Hôtel du Parc", contact: "Antoine Giraud", city: "Dijon", phone: "03 80 60 23 10", status: "qualified" as LeadStatus, source: "Partenaire", value: 3240, note: "Audit complet demandé avant remise aux normes." },
  { id: "l-09", company: "Chez Auguste", contact: "Louis Marchand", city: "Paris 5e", phone: "01 43 26 51 88", status: "quote_sent" as LeadStatus, source: "Site web", value: 1380, note: "Devis envoyé ce matin." },
];

export const clients = [
  { id: "c-01", name: "Le Comptoir du Marais", contact: "Claire Dubois", email: "claire@comptoirdumarais.fr", city: "Paris 3e", address: "18 rue de Bretagne, 75003 Paris", phone: "01 42 72 31 09", contract: "Sérénité trimestriel", since: "2022", revenue: 4820, installations: 2 },
  { id: "c-02", name: "Hôtel des Arts Perpignan", contact: "Romain Vidal", email: "r.vidal@hotelarts.fr", city: "Perpignan", address: "9 avenue des Palmiers, 66000 Perpignan", phone: "04 68 34 11 50", contract: "Conformité semestriel", since: "2023", revenue: 3960, installations: 2 },
  { id: "c-03", name: "Brasserie Saint-Jean Troyes", contact: "Paul Lemoine", email: "direction@saintjeantroyes.fr", city: "Troyes", address: "4 place Saint-Jean, 10000 Troyes", phone: "03 25 73 04 12", contract: "Sérénité trimestriel", since: "2021", revenue: 6180, installations: 3 },
  { id: "c-04", name: "Relais Gourmet Dijon", contact: "Marie Chevalier", email: "m.chevalier@relaisgourmet.fr", city: "Dijon", address: "26 rue Musette, 21000 Dijon", phone: "03 80 43 29 86", contract: "Essentiel semestriel", since: "2024", revenue: 2640, installations: 1 },
  { id: "c-05", name: "La Verrière Montmartre", contact: "Thomas Bernard", email: "thomas@laverierre.fr", city: "Paris 18e", address: "41 rue des Abbesses, 75018 Paris", phone: "01 46 06 14 88", contract: "Sérénité trimestriel", since: "2020", revenue: 5450, installations: 2 },
  { id: "c-06", name: "Maison Colette", contact: "Aïcha Martin", email: "a.martin@maisoncolette.fr", city: "Paris 7e", address: "12 rue Saint-Dominique, 75007 Paris", phone: "01 45 51 20 67", contract: "Conformité annuel", since: "2023", revenue: 3180, installations: 1 },
  { id: "c-07", name: "Les Jardins de l'Aube", contact: "Émilie Fontaine", email: "contact@jardinsaube.fr", city: "Troyes", address: "8 quai Dampierre, 10000 Troyes", phone: "03 25 41 67 90", contract: "Essentiel semestriel", since: "2024", revenue: 1890, installations: 1 },
];

export const installations = [
  { id: "i-01", clientId: "c-01", label: "Cuisine principale", hood: "Hotte inox 3,2 m", filters: "12 filtres labyrinthes", duct: "18 ml conduit galvanisé", motor: "Moteur 1,5 kW toiture" },
  { id: "i-02", clientId: "c-01", label: "Poste grillades", hood: "Hotte murale 1,8 m", filters: "6 filtres labyrinthes", duct: "9 ml conduit", motor: "Moteur 0,75 kW" },
  { id: "i-03", clientId: "c-02", label: "Cuisine restaurant", hood: "Hotte centrale 4 m", filters: "16 filtres inox", duct: "24 ml conduit calorifugé", motor: "Moteur 2,2 kW" },
  { id: "i-04", clientId: "c-03", label: "Cuisine brasserie", hood: "Hotte inox 3,8 m", filters: "14 filtres labyrinthes", duct: "31 ml conduit", motor: "Caisson extraction 2,2 kW" },
  { id: "i-05", clientId: "c-04", label: "Cuisine ouverte", hood: "Hotte design 2,4 m", filters: "8 filtres labyrinthes", duct: "14 ml conduit", motor: "Moteur 1,1 kW" },
  { id: "i-06", clientId: "c-05", label: "Cuisine principale", hood: "Hotte centrale 3,5 m", filters: "14 filtres inox", duct: "22 ml conduit", motor: "Caisson toiture 1,5 kW" },
];

export const interventions = [
  { id: "int-01", clientId: "c-01", date: "16 sept. 2026 · 06:30", title: "Nettoyage complet — cuisine principale", technician: "Karim B.", status: "planned" as WorkStatus, duration: "4 h", amount: 960 },
  { id: "int-02", clientId: "c-02", date: "18 sept. 2026 · 07:00", title: "Dégraissage hottes & conduits", technician: "Lucas M.", status: "planned" as WorkStatus, duration: "6 h", amount: 1420 },
  { id: "int-03", clientId: "c-03", date: "23 sept. 2026 · 05:45", title: "Entretien trimestriel", technician: "Karim B. + équipe", status: "planned" as WorkStatus, duration: "5 h", amount: 1180 },
  { id: "int-04", clientId: "c-04", date: "9 sept. 2026 · 07:15", title: "Nettoyage hotte cuisine ouverte", technician: "Lucas M.", status: "completed" as WorkStatus, duration: "3 h", amount: 680 },
  { id: "int-05", clientId: "c-05", date: "5 sept. 2026 · 06:00", title: "Nettoyage annuel des conduits", technician: "Karim B. + équipe", status: "completed" as WorkStatus, duration: "7 h", amount: 1640 },
  { id: "int-06", clientId: "c-06", date: "26 sept. 2026 · 06:30", title: "Contrôle conformité extraction", technician: "Lucas M.", status: "planned" as WorkStatus, duration: "3 h", amount: 820 },
  { id: "int-07", clientId: "c-07", date: "2 sept. 2026 · 07:30", title: "Entretien semestriel", technician: "Karim B.", status: "completed" as WorkStatus, duration: "3 h", amount: 630 },
];

export const quotes = [
  { id: "d-2026-041", clientId: "c-01", date: "02 sept. 2026", valid: "02 oct. 2026", status: "accepted", total: 1140, items: ["Dégraissage hotte 3,2 m", "Nettoyage 18 ml de conduits", "Remise certificat"] },
  { id: "d-2026-042", clientId: "c-04", date: "04 sept. 2026", valid: "04 oct. 2026", status: "sent", total: 760, items: ["Nettoyage hotte cuisine ouverte", "Dégraissage filtres", "Rapport photo"] },
  { id: "d-2026-043", clientId: "c-03", date: "08 sept. 2026", valid: "08 oct. 2026", status: "accepted", total: 1480, items: ["Entretien 3 postes d'extraction", "Nettoyage conduits", "Contrôle motorisation"] },
  { id: "d-2026-044", clientId: "c-02", date: "10 sept. 2026", valid: "10 oct. 2026", status: "sent", total: 1840, items: ["Nettoyage 2 cuisines", "Dégraissage 24 ml de conduit", "Certificat conformité"] },
  { id: "d-2026-045", clientId: "c-06", date: "11 sept. 2026", valid: "11 oct. 2026", status: "draft", total: 980, items: ["Audit extraction", "Nettoyage hotte", "Préconisations techniques"] },
];

export const invoices = [
  { id: "f-2026-118", clientId: "c-05", issued: "05 sept. 2026", due: "05 oct. 2026", status: "paid" as InvoiceStatus, total: 1640, remaining: 0 },
  { id: "f-2026-119", clientId: "c-04", issued: "09 sept. 2026", due: "09 oct. 2026", status: "partial" as InvoiceStatus, total: 680, remaining: 280 },
  { id: "f-2026-115", clientId: "c-03", issued: "18 août 2026", due: "17 sept. 2026", status: "overdue" as InvoiceStatus, total: 2180, remaining: 2180 },
  { id: "f-2026-116", clientId: "c-01", issued: "22 août 2026", due: "21 sept. 2026", status: "overdue" as InvoiceStatus, total: 1140, remaining: 1140 },
  { id: "f-2026-117", clientId: "c-02", issued: "28 août 2026", due: "27 sept. 2026", status: "paid" as InvoiceStatus, total: 1420, remaining: 0 },
];

export const payments = [
  { id: "p-01", invoiceId: "f-2026-118", date: "08 sept. 2026", clientId: "c-05", method: "Virement", amount: 1640 },
  { id: "p-02", invoiceId: "f-2026-119", date: "10 sept. 2026", clientId: "c-04", method: "Carte bancaire", amount: 400 },
  { id: "p-03", invoiceId: "f-2026-117", date: "02 sept. 2026", clientId: "c-02", method: "Virement", amount: 1420 },
  { id: "p-04", invoiceId: "f-2026-112", date: "25 août 2026", clientId: "c-01", method: "Prélèvement", amount: 980 },
  { id: "p-05", invoiceId: "f-2026-110", date: "18 août 2026", clientId: "c-03", method: "Virement", amount: 1260 },
  { id: "p-06", invoiceId: "f-2026-109", date: "12 août 2026", clientId: "c-06", method: "Carte bancaire", amount: 820 },
];

export const providers = [
  { id: "pr-01", name: "Équipe Nord — Karim Benali", speciality: "Nettoyage extraction", area: "Paris & Île-de-France", rating: "4,9", jobs: 42, status: "Disponible" },
  { id: "pr-02", name: "Proprex Sud", speciality: "Dégraissage industriel", area: "Occitanie", rating: "4,8", jobs: 18, status: "Disponible" },
  { id: "pr-03", name: "Bourgogne Maintenance", speciality: "Conduits & motorisation", area: "Dijon · Troyes", rating: "4,7", jobs: 27, status: "Planifié" },
];

export const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Client";
export const euro = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
