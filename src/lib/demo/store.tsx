import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { calculateQuote, productCost, type QuoteLineInput } from "@/lib/quotes/calculate";
import { createInitialDemoState, DEMO_NOW, DEMO_STATE_VERSION, STORAGE_KEY } from "@/lib/demo/fixtures";
import type {
  DemoActivity,
  DemoClient,
  DemoConversation,
  DemoDocument,
  DemoInstallation,
  DemoIntervention,
  DemoInvoice,
  DemoLead,
  DemoMessage,
  DemoPhoto,
  DemoProduct,
  DemoQuote,
  DemoQuoteLine,
  DemoReport,
  DemoRole,
  DemoState,
  DemoUser,
} from "@/lib/demo/types";
import type { QuoteWorkflowStatus } from "@/lib/quotes/labels";

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialDemoState();
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed.version !== DEMO_STATE_VERSION) return createInitialDemoState();
    return parsed;
  } catch {
    return createInitialDemoState();
  }
}

function persist(state: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function quoteTotals(state: DemoState, quoteId: string) {
  const quote = state.quotes.find((q) => q.id === quoteId);
  const lines = state.quoteLines
    .filter((l) => l.quoteId === quoteId)
    .sort((a, b) => a.position - b.position);
  return calculateQuote(
    lines.map(
      (l): QuoteLineInput => ({
        label: l.label,
        quantity: l.quantity,
        unitPriceHt: l.unitPriceHt,
        vatRate: l.vatRate,
      }),
    ),
    { discountHt: quote?.discountHt, depositAmount: quote?.depositAmount },
  );
}

export function invoiceBalance(state: DemoState, invoiceId: string) {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const lines = state.invoiceLines.filter((l) => l.invoiceId === invoiceId);
  const totals = calculateQuote(
    lines.map((l) => ({ label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate })),
  );
  const paid = state.payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, Math.round((totals.totalTtc - paid) * 100) / 100);
  const overdue = Boolean(invoice && !invoice.cancelled && remaining > 0 && invoice.dueAt < DEMO_NOW.slice(0, 10));
  const status = invoice?.cancelled
    ? "cancelled"
    : remaining <= 0
      ? "paid"
      : overdue
        ? "overdue"
        : paid > 0
          ? "partial"
          : "unpaid";
  return { ...totals, paid: Math.round(paid * 100) / 100, remaining, overdue, status };
}

type StoreApi = {
  state: DemoState;
  currentUser: DemoUser | null;
  role: DemoRole;
  isProvider: boolean;
  clientById: (id: string) => DemoClient | undefined;
  logActivity: (partial: Omit<DemoActivity, "id" | "createdAt"> & { createdAt?: string }) => void;
  login: (email: string, password: string, remember: boolean) => string | null;
  logout: () => void;
  register: (input: { name: string; email: string; password: string; requestedRole: DemoRole }) => string | null;
  approveUser: (userId: string, role: DemoRole) => void;
  convertLead: (leadId: string) => string;
  updateLead: (id: string, patch: Partial<DemoLead>) => void;
  prepareLeadForQuote: (leadId: string) => { clientId: string; installationId: string };
  simulateWebsiteRequest: () => string;
  createClient: (input: Omit<DemoClient, "id" | "leadId" | "since" | "commercialId" | "contract"> & { leadId?: string }) => string;
  updateClient: (id: string, patch: Partial<DemoClient>) => void;
  createInstallation: (input: Omit<DemoInstallation, "id">) => string;
  saveQuote: (quote: Omit<DemoQuote, "id" | "reference" | "createdAt" | "interventionId" | "invoiceId" | "leadId"> & { id?: string; leadId?: string | null }, lines: Omit<DemoQuoteLine, "id" | "quoteId">[]) => string;
  setQuoteStatus: (id: string, status: QuoteWorkflowStatus) => void;
  duplicateQuote: (id: string) => string;
  deleteQuote: (id: string) => void;
  convertQuoteToIntervention: (quoteId: string) => string;
  updateIntervention: (id: string, patch: Partial<DemoIntervention>) => { conflict?: string };
  checkProviderConflict: (providerId: string, date: string, start: string, end: string, excludeId?: string) => DemoIntervention | undefined;
  addPhoto: (photo: Omit<DemoPhoto, "id" | "createdAt">) => void;
  deletePhoto: (id: string) => void;
  upsertProduct: (product: Omit<DemoProduct, "id"> & { id?: string }) => void;
  deleteProduct: (id: string) => void;
  saveReport: (report: Omit<DemoReport, "id"> & { id?: string }) => string;
  createInvoiceFrom: (source: { quoteId?: string; interventionId?: string; clientId: string }) => string;
  recordPayment: (input: { invoiceId: string; amount: number; method: DemoState["payments"][number]["method"]; reference?: string; note?: string }) => void;
  addMessage: (msg: Omit<DemoMessage, "id" | "createdAt" | "readBy">) => void;
  ensureInterventionChat: (interventionId: string) => string;
  markConversationRead: (conversationId: string) => void;
  markNotificationsRead: () => void;
  addDocument: (doc: Omit<DemoDocument, "id">) => void;
  deleteDocument: (id: string) => void;
  updateSettings: (patch: Partial<DemoState["settings"]>) => void;
  updateCatalogItem: (id: string, patch: Partial<DemoState["catalog"][number]>) => void;
  resetDemo: () => void;
  createConversation: (input: { title: string; kind: DemoConversation["kind"]; memberIds: string[]; interventionId?: string }) => string;
};

const DemoStoreContext = createContext<StoreApi | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => loadState());

  const commit = useCallback((updater: (prev: DemoState) => DemoState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.sessionUserId) ?? null,
    [state.users, state.sessionUserId],
  );
  const role: DemoRole = currentUser?.role ?? "admin";
  const isProvider = role === "prestataire";

  const clientById = useCallback((id: string) => state.clients.find((c) => c.id === id), [state.clients]);

  const logActivity = useCallback(
    (partial: Omit<DemoActivity, "id" | "createdAt"> & { createdAt?: string }) => {
      commit((prev) => ({
        ...prev,
        activities: [
          {
            id: nid("act"),
            createdAt: partial.createdAt ?? nowIso(),
            ...partial,
          },
          ...prev.activities,
        ],
      }));
    },
    [commit],
  );

  const api = useMemo<StoreApi>(() => {
    return {
      state,
      currentUser,
      role,
      isProvider,
      clientById,
      logActivity,
      login: (email, password, remember) => {
        const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user) return "Compte introuvable.";
        if (user.password !== password) return "Mot de passe incorrect.";
        if (user.status !== "active") return "Compte en attente de validation par la direction.";
        commit((prev) => ({ ...prev, sessionUserId: user.id, remember }));
        return null;
      },
      logout: () => commit((prev) => ({ ...prev, sessionUserId: null })),
      register: ({ name, email, password, requestedRole }) => {
        if (state.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
          return "Un compte existe déjà avec cet email.";
        }
        commit((prev) => ({
          ...prev,
          users: [
            ...prev.users,
            {
              id: nid("u"),
              name,
              email: email.trim(),
              password,
              role: "prestataire",
              requestedRole,
              status: "pending_approval",
            },
          ],
        }));
        return null;
      },
      approveUser: (userId, assignedRole) => {
        commit((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, status: "active", role: assignedRole } : u,
          ),
        }));
      },
      convertLead: (leadId) => {
        const lead = state.leads.find((l) => l.id === leadId);
        if (!lead) throw new Error("Prospect introuvable");
        if (lead.convertedClientId) return lead.convertedClientId;
        const clientId = nid("c");
        const installId = nid("ins");
        commit((prev) => ({
          ...prev,
          leads: prev.leads.map((l) => (l.id === leadId ? { ...l, status: "won", convertedClientId: clientId } : l)),
          clients: [
            {
              id: clientId,
              leadId,
              name: lead.company,
              contact: lead.contact,
              phone: lead.phone,
              email: lead.email,
              address: lead.address,
              postalCode: lead.postalCode,
              city: lead.city,
              zone: lead.zone,
              siren: lead.siren,
              siret: lead.siret,
              businessType: lead.businessType,
              notes: lead.note,
              contract: "Nouveau client",
              since: "2026",
              commercialId: prev.sessionUserId ?? "u-sophie",
            },
            ...prev.clients,
          ],
          installations: [
            {
              id: installId,
              clientId,
              label: "Installation principale",
              hoodType: lead.hoodType,
              hoodLength: lead.hoodLength,
              filterCount: lead.filterCount,
              filterType: lead.filterType,
              ductPresent: lead.ductPresent,
              ductLength: lead.ductLength,
              ductAccessibility: lead.accessibility,
              motorPresent: lead.motorPresent,
              motorType: lead.motorType,
              motorAccessibility: lead.accessibility,
              soilLevel: lead.soilLevel,
              nightIntervention: lead.nightIntervention,
              schedulePreferences: lead.schedulePreference,
              remarks: lead.note,
            },
            ...prev.installations,
          ],
          activities: [
            {
              id: nid("act"),
              clientId,
              leadId,
              type: "LEAD_CONVERTED",
              title: `Prospect converti — ${lead.company}`,
              description: "Données commerciales et techniques reprises.",
              createdAt: nowIso(),
            },
            {
              id: nid("act"),
              clientId,
              leadId,
              type: "CLIENT_CREATED",
              title: `Client créé — ${lead.company}`,
              description: "",
              createdAt: nowIso(),
            },
            ...prev.activities,
          ],
          notifications: [
            {
              id: nid("n"),
              title: "Nouveau client",
              body: lead.company,
              href: `/clients/${clientId}`,
              createdAt: nowIso(),
              read: false,
              role: "admin",
            },
            ...prev.notifications,
          ],
        }));
        return clientId;
      },
      updateLead: (id, patch) => {
        commit((prev) => ({
          ...prev,
          leads: prev.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }));
      },
      prepareLeadForQuote: (leadId) => {
        const existing = state.leads.find((l) => l.id === leadId);
        if (!existing) throw new Error("Demande introuvable");
        const byEmail = existing.email
          ? state.clients.find((c) => c.email.toLowerCase() === existing.email.toLowerCase())
          : undefined;
        const fromLead = state.clients.find((c) => c.leadId === leadId);
        const clientId = existing.convertedClientId ?? byEmail?.id ?? fromLead?.id ?? nid("c");
        const existingInstall = state.installations.find((i) => i.clientId === clientId);
        const installId = existingInstall?.id ?? nid("ins");
        commit((prev) => {
          const clientExists = prev.clients.some((c) => c.id === clientId);
          const installExists = prev.installations.some((i) => i.clientId === clientId);
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l.id === leadId
                ? {
                    ...l,
                    convertedClientId: clientId,
                    status: l.status === "new" ? "contacted" : l.status,
                  }
                : l,
            ),
            clients: clientExists
              ? prev.clients
              : [
                  {
                    id: clientId,
                    leadId,
                    name: existing.company,
                    contact: existing.contact,
                    phone: existing.phone,
                    email: existing.email,
                    address: existing.address,
                    postalCode: existing.postalCode,
                    city: existing.city,
                    zone: existing.zone,
                    siren: existing.siren,
                    siret: existing.siret,
                    businessType: existing.businessType,
                    notes: existing.note,
                    contract: "Nouveau client",
                    since: "2026",
                    commercialId: prev.sessionUserId ?? "u-sophie",
                  },
                  ...prev.clients,
                ],
            installations: installExists
              ? prev.installations
              : [
                  {
                    id: installId,
                    clientId,
                    label: "Installation principale",
                    hoodType: existing.hoodType,
                    hoodLength: existing.hoodLength,
                    filterCount: existing.filterCount,
                    filterType: existing.filterType,
                    ductPresent: existing.ductPresent,
                    ductLength: existing.ductLength,
                    ductAccessibility: existing.accessibility,
                    motorPresent: existing.motorPresent,
                    motorType: existing.motorType,
                    motorAccessibility: existing.accessibility,
                    soilLevel: existing.soilLevel,
                    nightIntervention: existing.nightIntervention,
                    schedulePreferences: existing.schedulePreference,
                    remarks: existing.note,
                  },
                  ...prev.installations,
                ],
          };
        });
        return { clientId, installationId: existingInstall?.id ?? installId };
      },
      simulateWebsiteRequest: () => {
        const id = nid("l");
        commit((prev) => ({
          ...prev,
          leads: [
            {
              id,
              company: "Pasta & Brasiers",
              contact: "Inès Moreau",
              phone: "01 43 55 21 90",
              email: "ines@pastabrasiers.fr",
              address: "8 rue de Charonne",
              postalCode: "75011",
              city: "Paris",
              zone: "Paris",
              siren: "912 330 441",
              siret: "912 330 441 00012",
              businessType: "Restaurant",
              source: "website_form",
              status: "new",
              value: 1180,
              note: "Nouvelle demande simulée depuis le formulaire public. Hotte récente, premier dégraissage.",
              hoodType: "Hotte murale inox",
              hoodLength: "2,7 m",
              filterCount: 9,
              convertedClientId: null,
              channel: "website",
              consent: true,
              urgency: "prioritaire",
              requestType: "ponctuelle",
              maintenanceFrequency: "a_determiner",
              lastCleaning: "Inconnu",
              filterType: "Labyrinthe",
              ductPresent: true,
              ductLength: "14 ml",
              motorPresent: true,
              motorType: "Moteur 1,1 kW",
              accessibility: "Bon",
              soilLevel: "Moyen",
              nightIntervention: true,
              schedulePreference: "Après fermeture",
              preferredContact: "email",
              landingPage: "/devis",
              photos: [
                {
                  id: nid("ph"),
                  url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect fill="#1e293b" width="100%" height="100%"/><text x="50%" y="50%" fill="#e2e8f0" text-anchor="middle" font-size="28">Photo site</text></svg>'),
                  kind: "before",
                  name: "hotte-site.jpg",
                },
              ],
              assignedUserId: null,
              quoteId: null,
              submittedAt: nowIso(),
            },
            ...prev.leads,
          ],
          notifications: [
            {
              id: nid("n"),
              title: "Nouvelle demande de devis",
              body: "Pasta & Brasiers — formulaire site",
              href: `/demandes-devis/${id}`,
              createdAt: nowIso(),
              read: false,
              role: "admin",
            },
            ...prev.notifications,
          ],
        }));
        return id;
      },
      createClient: (input) => {
        const id = nid("c");
        commit((prev) => ({
          ...prev,
          clients: [
            {
              id,
              leadId: input.leadId ?? null,
              since: "2026",
              commercialId: prev.sessionUserId ?? "u-sophie",
              contract: "Nouveau client",
              ...input,
            },
            ...prev.clients,
          ],
          activities: [
            {
              id: nid("act"),
              clientId: id,
              leadId: input.leadId ?? null,
              type: "CLIENT_CREATED",
              title: `Client créé — ${input.name}`,
              description: "",
              createdAt: nowIso(),
            },
            ...prev.activities,
          ],
        }));
        return id;
      },
      updateClient: (id, patch) => {
        commit((prev) => ({
          ...prev,
          clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },
      createInstallation: (input) => {
        const id = nid("ins");
        commit((prev) => ({ ...prev, installations: [{ ...input, id }, ...prev.installations] }));
        return id;
      },
      saveQuote: (quote, lines) => {
        const isNew = !quote.id;
        const id = quote.id ?? nid("q");
        commit((prev) => {
          const reference = quote.id
            ? (prev.quotes.find((q) => q.id === quote.id)?.reference ?? `${prev.settings.quotePrefix}-2026-${String(prev.quoteSeq).padStart(3, "0")}`)
            : `${prev.settings.quotePrefix}-2026-${String(prev.quoteSeq).padStart(3, "0")}`;
          const leadId = quote.leadId ?? prev.quotes.find((q) => q.id === id)?.leadId ?? null;
          const record: DemoQuote = {
            id,
            reference,
            clientId: quote.clientId,
            leadId,
            installationId: quote.installationId,
            commercialId: quote.commercialId,
            status: quote.status,
            issuedAt: quote.issuedAt,
            validUntil: quote.validUntil,
            notes: quote.notes,
            paymentTerms: quote.paymentTerms,
            discountHt: quote.discountHt,
            depositAmount: quote.depositAmount,
            interventionId: prev.quotes.find((q) => q.id === id)?.interventionId ?? null,
            invoiceId: prev.quotes.find((q) => q.id === id)?.invoiceId ?? null,
            createdAt: quote.id ? (prev.quotes.find((q) => q.id === id)?.createdAt ?? nowIso()) : nowIso(),
          };
          const nextLines: DemoQuoteLine[] = lines.map((line, index) => ({
            ...line,
            id: nid("ql"),
            quoteId: id,
            position: index,
          }));
          return {
            ...prev,
            quoteSeq: isNew ? prev.quoteSeq + 1 : prev.quoteSeq,
            quotes: isNew ? [record, ...prev.quotes] : prev.quotes.map((q) => (q.id === id ? record : q)),
            quoteLines: [...prev.quoteLines.filter((l) => l.quoteId !== id), ...nextLines],
            leads: leadId
              ? prev.leads.map((l) =>
                  l.id === leadId
                    ? {
                        ...l,
                        quoteId: id,
                        convertedClientId: quote.clientId,
                        status: l.status === "won" || l.status === "lost" ? l.status : "quote_requested",
                      }
                    : l,
                )
              : prev.leads,
            activities: isNew
              ? [
                  {
                    id: nid("act"),
                    clientId: quote.clientId,
                    leadId,
                    type: "QUOTE_CREATED",
                    title: `Devis ${reference} créé`,
                    description: leadId ? "Depuis une demande de devis site" : "",
                    createdAt: nowIso(),
                  },
                  ...prev.activities,
                ]
              : prev.activities,
          };
        });
        return id;
      },
      setQuoteStatus: (id, status) => {
        commit((prev) => {
          const quote = prev.quotes.find((q) => q.id === id);
          if (!quote) return prev;
          const type =
            status === "sent" || status === "viewed" || status === "pending"
              ? "QUOTE_SENT"
              : status === "accepted"
                ? "QUOTE_ACCEPTED"
                : "STATUS_CHANGED";
          return {
            ...prev,
            quotes: prev.quotes.map((q) => (q.id === id ? { ...q, status } : q)),
            leads: prev.leads.map((l) => {
              if (l.quoteId !== id && l.id !== quote.leadId) return l;
              if (status === "sent" || status === "viewed" || status === "pending") return { ...l, status: "quote_sent" };
              if (status === "accepted" || status === "converted_intervention" || status === "converted_invoice") return { ...l, status: "won" };
              if (status === "rejected") return { ...l, status: "lost" };
              return l;
            }),
            activities: [
              {
                id: nid("act"),
                clientId: quote.clientId,
                leadId: quote.leadId,
                type: status === "accepted" ? "QUOTE_ACCEPTED" : type,
                title: `Devis ${quote.reference} — ${status}`,
                description: "",
                createdAt: nowIso(),
              },
              ...prev.activities,
            ],
            notifications:
              status === "accepted"
                ? [
                    {
                      id: nid("n"),
                      title: "Devis accepté",
                      body: quote.reference,
                      href: `/devis/${id}`,
                      createdAt: nowIso(),
                      read: false,
                      role: "admin",
                    },
                    ...prev.notifications,
                  ]
                : prev.notifications,
          };
        });
      },
      duplicateQuote: (id) => {
        const quote = state.quotes.find((q) => q.id === id);
        if (!quote) throw new Error("Devis introuvable");
        const lines = state.quoteLines.filter((l) => l.quoteId === id);
        const newId = nid("q");
        commit((prev) => {
          const reference = `${prev.settings.quotePrefix}-2026-${String(prev.quoteSeq).padStart(3, "0")}`;
          return {
            ...prev,
            quoteSeq: prev.quoteSeq + 1,
            quotes: [
              {
                ...quote,
                id: newId,
                reference,
                status: "draft",
                leadId: null,
                issuedAt: DEMO_NOW.slice(0, 10),
                interventionId: null,
                invoiceId: null,
                createdAt: nowIso(),
              },
              ...prev.quotes,
            ],
            quoteLines: [
              ...lines.map((l, i) => ({ ...l, id: nid("ql"), quoteId: newId, position: i })),
              ...prev.quoteLines,
            ],
          };
        });
        return newId;
      },
      deleteQuote: (id) => {
        commit((prev) => ({
          ...prev,
          quotes: prev.quotes.filter((q) => q.id !== id),
          quoteLines: prev.quoteLines.filter((l) => l.quoteId !== id),
        }));
      },
      convertQuoteToIntervention: (quoteId) => {
        const quote = state.quotes.find((q) => q.id === quoteId);
        if (!quote) throw new Error("Devis introuvable");
        if (quote.interventionId) return quote.interventionId;
        const client = state.clients.find((c) => c.id === quote.clientId);
        const install = state.installations.find((i) => i.id === quote.installationId);
        const totals = quoteTotals(state, quoteId);
        const lines = state.quoteLines.filter((l) => l.quoteId === quoteId);
        const id = nid("int");
        commit((prev) => {
          const reference = `INT-2026-${String(prev.interventionSeq).padStart(3, "0")}`;
          const intervention: DemoIntervention = {
            id,
            reference,
            clientId: quote.clientId,
            installationId: quote.installationId,
            quoteId,
            providerId: null,
            city: client?.city ?? "",
            address: client ? `${client.address}, ${client.postalCode} ${client.city}` : "",
            date: "",
            startTime: "06:30",
            endTime: "10:30",
            service: lines[0]?.label ?? "Intervention",
            status: "to_plan",
            amountTtc: totals.totalTtc,
            description: lines.map((l) => l.label).join(" · "),
            notes: quote.notes,
            invoiceId: null,
          };
          const chatId = nid("cv");
          return {
            ...prev,
            interventionSeq: prev.interventionSeq + 1,
            quotes: prev.quotes.map((q) =>
              q.id === quoteId ? { ...q, status: "converted_intervention", interventionId: id } : q,
            ),
            interventions: [intervention, ...prev.interventions],
            conversations: [
              {
                id: chatId,
                title: `${reference} — ${client?.name ?? "Intervention"}`,
                kind: "intervention",
                interventionId: id,
                memberIds: ["u-sophie", "u-karim"],
              },
              ...prev.conversations,
            ],
            activities: [
              {
                id: nid("act"),
                clientId: quote.clientId,
                leadId: null,
                type: "INTERVENTION_CREATED",
                title: `Intervention ${reference} créée depuis ${quote.reference}`,
                description: install?.label ?? "",
                createdAt: nowIso(),
              },
              ...prev.activities,
            ],
            notifications: [
              {
                id: nid("n"),
                title: "Nouvelle intervention à planifier",
                body: `${reference} — ${client?.name ?? ""}`,
                href: `/interventions/${id}`,
                createdAt: nowIso(),
                read: false,
                role: "admin",
              },
              ...prev.notifications,
            ],
          };
        });
        return id;
      },
      checkProviderConflict: (providerId, date, start, end, excludeId) => {
        return state.interventions.find(
          (i) =>
            i.id !== excludeId &&
            i.providerId === providerId &&
            i.date === date &&
            i.status !== "cancelled" &&
            i.startTime &&
            i.endTime &&
            overlap(i.startTime, i.endTime, start, end),
        );
      },
      updateIntervention: (id, patch) => {
        const current = state.interventions.find((i) => i.id === id);
        if (!current) return {};
        const nextProvider = patch.providerId ?? current.providerId;
        const nextDate = patch.date ?? current.date;
        const nextStart = patch.startTime ?? current.startTime;
        const nextEnd = patch.endTime ?? current.endTime;
        if (nextProvider && nextDate && nextStart && nextEnd) {
          const conflict = state.interventions.find(
            (i) =>
              i.id !== id &&
              i.providerId === nextProvider &&
              i.date === nextDate &&
              i.status !== "cancelled" &&
              overlap(i.startTime, i.endTime, nextStart, nextEnd),
          );
          if (conflict) {
            return {
              conflict: `Ce prestataire est déjà assigné à une intervention durant ce créneau (${conflict.reference} — ${conflict.startTime}–${conflict.endTime}).`,
            };
          }
        }
        commit((prev) => {
          const before = prev.interventions.find((i) => i.id === id);
          const merged = { ...current, ...patch };
          let activities = prev.activities;
          if (before && patch.status === "completed" && before.status !== "completed") {
            activities = [
              {
                id: nid("act"),
                clientId: current.clientId,
                leadId: null,
                type: "INTERVENTION_COMPLETED",
                title: `Intervention ${current.reference} terminée`,
                description: "",
                createdAt: nowIso(),
              },
              ...activities,
            ];
          }
          return {
            ...prev,
            interventions: prev.interventions.map((i) => (i.id === id ? merged : i)),
            activities,
          };
        });
        return {};
      },
      addPhoto: (photo) => {
        commit((prev) => ({
          ...prev,
          photos: [{ ...photo, id: nid("ph"), createdAt: nowIso() }, ...prev.photos],
          activities: [
            {
              id: nid("act"),
              clientId: photo.clientId,
              leadId: null,
              type: "PHOTO_UPLOADED",
              title: `Photo ${photo.kind === "before" ? "avant" : photo.kind === "after" ? "après" : "technique"} ajoutée`,
              description: photo.comment,
              createdAt: nowIso(),
            },
            ...prev.activities,
          ],
        }));
      },
      deletePhoto: (id) => commit((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) })),
      upsertProduct: (product) => {
        commit((prev) => {
          if (product.id) {
            return { ...prev, products: prev.products.map((p) => (p.id === product.id ? { ...p, ...product, id: product.id } : p)) };
          }
          return { ...prev, products: [{ ...product, id: nid("prod") }, ...prev.products] };
        });
      },
      deleteProduct: (id) => commit((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) })),
      saveReport: (report) => {
        const existing = state.reports.find((r) => r.interventionId === report.interventionId);
        const id = report.id ?? existing?.id ?? nid("rep");
        commit((prev) => {
          const next = { ...report, id };
          const list = prev.reports.some((r) => r.id === id)
            ? prev.reports.map((r) => (r.id === id ? next : r))
            : [next, ...prev.reports];
          const intervention = prev.interventions.find((i) => i.id === report.interventionId);
          const signed = Boolean(next.providerSignature && next.clientSignature);
          return {
            ...prev,
            reports: list,
            interventions: prev.interventions.map((i) =>
              i.id === report.interventionId
                ? { ...i, status: signed ? "report_validated" : "report_pending" }
                : i,
            ),
            activities: signed
              ? [
                  {
                    id: nid("act"),
                    clientId: intervention?.clientId ?? null,
                    leadId: null,
                    type: "REPORT_VALIDATED",
                    title: "Rapport validé et signé",
                    description: next.clientSignature ?? "",
                    createdAt: nowIso(),
                  },
                  ...prev.activities,
                ]
              : prev.activities,
          };
        });
        return id;
      },
      createInvoiceFrom: ({ quoteId, interventionId, clientId }) => {
        const id = nid("inv");
        commit((prev) => {
          const quote = quoteId ? prev.quotes.find((q) => q.id === quoteId) : prev.quotes.find((q) => q.id === prev.interventions.find((i) => i.id === interventionId)?.quoteId);
          const sourceQuoteId = quote?.id ?? quoteId ?? null;
          const sourceLines = sourceQuoteId ? prev.quoteLines.filter((l) => l.quoteId === sourceQuoteId) : [];
          const number = `${prev.settings.invoicePrefix}-2026-${String(prev.invoiceSeq).padStart(3, "0")}`;
          const issuedAt = DEMO_NOW.slice(0, 10);
          const due = new Date(`${issuedAt}T00:00:00`);
          due.setDate(due.getDate() + 30);
          const dueAt = due.toISOString().slice(0, 10);
          const invoice: DemoInvoice = {
            id,
            number,
            clientId,
            quoteId: sourceQuoteId,
            interventionId: interventionId ?? null,
            issuedAt,
            dueAt,
            notes: quote?.notes ?? "",
            paymentTerms: quote?.paymentTerms ?? prev.settings.paymentTerms,
            eStatus: "ready",
            cancelled: false,
          };
          return {
            ...prev,
            invoiceSeq: prev.invoiceSeq + 1,
            invoices: [invoice, ...prev.invoices],
            invoiceLines: [
              ...sourceLines.map((l, i) => ({
                id: nid("il"),
                invoiceId: id,
                label: l.label,
                description: l.description,
                unit: l.unit,
                quantity: l.quantity,
                unitPriceHt: l.unitPriceHt,
                vatRate: l.vatRate,
                position: i,
              })),
              ...prev.invoiceLines,
            ],
            quotes: prev.quotes.map((q) =>
              sourceQuoteId && q.id === sourceQuoteId ? { ...q, invoiceId: id, status: "converted_invoice" } : q,
            ),
            interventions: interventionId
              ? prev.interventions.map((i) => (i.id === interventionId ? { ...i, invoiceId: id, status: "invoiced" } : i))
              : prev.interventions,
            activities: [
              {
                id: nid("act"),
                clientId,
                leadId: null,
                type: "INVOICE_CREATED",
                title: `Facture ${number} créée`,
                description: quote?.reference ?? "",
                createdAt: nowIso(),
              },
              ...prev.activities,
            ],
          };
        });
        return id;
      },
      recordPayment: ({ invoiceId, amount, method, reference, note }) => {
        const invoice = state.invoices.find((i) => i.id === invoiceId);
        if (!invoice) return;
        commit((prev) => ({
          ...prev,
          payments: [
            {
              id: nid("pay"),
              invoiceId,
              clientId: invoice.clientId,
              amount,
              paidAt: DEMO_NOW.slice(0, 10),
              method,
              reference: reference ?? "",
              note: note ?? "",
            },
            ...prev.payments,
          ],
          activities: [
            {
              id: nid("act"),
              clientId: invoice.clientId,
              leadId: null,
              type: "PAYMENT_RECEIVED",
              title: `Paiement reçu — ${amount.toFixed(2)} €`,
              description: invoice.number,
              createdAt: nowIso(),
            },
            ...prev.activities,
          ],
          notifications: [
            {
              id: nid("n"),
              title: "Paiement reçu",
              body: invoice.number,
              href: `/factures/${invoiceId}`,
              createdAt: nowIso(),
              read: false,
              role: "admin",
            },
            ...prev.notifications,
          ],
        }));
      },
      addMessage: (msg) => {
        commit((prev) => ({
          ...prev,
          messages: [
            {
              ...msg,
              id: nid("msg"),
              createdAt: nowIso(),
              readBy: [msg.authorId],
            },
            ...prev.messages,
          ],
          notifications: [
            {
              id: nid("n"),
              title: "Nouveau message",
              body: msg.body.slice(0, 80) || msg.attachmentName || "Pièce jointe",
              href: "/chat",
              createdAt: nowIso(),
              read: false,
              role: "all",
            },
            ...prev.notifications,
          ],
        }));
      },
      ensureInterventionChat: (interventionId) => {
        const existing = state.conversations.find((c) => c.interventionId === interventionId);
        if (existing) return existing.id;
        const intervention = state.interventions.find((i) => i.id === interventionId);
        const id = nid("cv");
        commit((prev) => ({
          ...prev,
          conversations: [
            {
              id,
              title: `${intervention?.reference ?? "Intervention"}`,
              kind: "intervention",
              interventionId,
              memberIds: ["u-sophie", "u-karim", "u-lucas"],
            },
            ...prev.conversations,
          ],
        }));
        return id;
      },
      markConversationRead: (conversationId) => {
        const uid = state.sessionUserId;
        if (!uid) return;
        commit((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.conversationId === conversationId && !m.readBy.includes(uid)
              ? { ...m, readBy: [...m.readBy, uid] }
              : m,
          ),
        }));
      },
      markNotificationsRead: () => {
        commit((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      addDocument: (doc) => commit((prev) => ({ ...prev, documents: [{ ...doc, id: nid("doc") }, ...prev.documents] })),
      deleteDocument: (id) => commit((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== id) })),
      updateSettings: (patch) => commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
      updateCatalogItem: (id, patch) => {
        commit((prev) => ({
          ...prev,
          catalog: prev.catalog.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },
      resetDemo: () => {
        const fresh = createInitialDemoState();
        persist(fresh);
        setState(fresh);
      },
      createConversation: ({ title, kind, memberIds, interventionId }) => {
        const id = nid("cv");
        commit((prev) => ({
          ...prev,
          conversations: [{ id, title, kind, interventionId: interventionId ?? null, memberIds }, ...prev.conversations],
        }));
        return id;
      },
    };
  }, [state, currentUser, role, isProvider, clientById, logActivity, commit]);

  return <DemoStoreContext.Provider value={api}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error("useDemoStore must be used within DemoStoreProvider");
  return ctx;
}

export { productCost };
