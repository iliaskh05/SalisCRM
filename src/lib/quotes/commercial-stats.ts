export type CommercialQuoteInput = {
  commercialId: string | null;
  status: string;
  amountTtc: number;
};

export type CommercialPerson = {
  id: string;
  name: string;
};

export type CommercialStat = {
  id: string;
  name: string;
  issued: number;
  closed: number;
  pipeline: number;
  lost: number;
  closingRate: number;
  amountClosed: number;
};

const CLOSED_STATUSES = new Set(["accepted", "converted_intervention", "converted_invoice"]);
const PIPELINE_STATUSES = new Set(["ready", "sent", "viewed", "pending"]);
const LOST_STATUSES = new Set(["rejected", "expired"]);

export function isClosedQuote(status: string) {
  return CLOSED_STATUSES.has(status);
}

export function aggregateCommercialStats(
  people: CommercialPerson[],
  quotes: CommercialQuoteInput[],
): CommercialStat[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const quote of quotes) {
    const id = quote.commercialId;
    if (id && !byId.has(id)) {
      byId.set(id, { id, name: `Commercial ${id.slice(0, 8)}` });
    }
  }

  const rows = [...byId.values()].map((person) => {
    const mine = quotes.filter((q) => q.commercialId === person.id);
    const issued = mine.filter((q) => q.status !== "draft");
    const closed = mine.filter((q) => isClosedQuote(q.status));
    const pipeline = mine.filter((q) => PIPELINE_STATUSES.has(q.status));
    const lost = mine.filter((q) => LOST_STATUSES.has(q.status));
    return {
      id: person.id,
      name: person.name,
      issued: issued.length,
      closed: closed.length,
      pipeline: pipeline.length,
      lost: lost.length,
      closingRate: issued.length ? Math.round((closed.length / issued.length) * 100) : 0,
      amountClosed: closed.reduce((sum, q) => sum + q.amountTtc, 0),
    };
  });

  const unassigned = quotes.filter((q) => !q.commercialId);
  if (unassigned.length > 0) {
    const issued = unassigned.filter((q) => q.status !== "draft");
    const closed = unassigned.filter((q) => isClosedQuote(q.status));
    rows.push({
      id: "unassigned",
      name: "Non attribué",
      issued: issued.length,
      closed: closed.length,
      pipeline: unassigned.filter((q) => PIPELINE_STATUSES.has(q.status)).length,
      lost: unassigned.filter((q) => LOST_STATUSES.has(q.status)).length,
      closingRate: issued.length ? Math.round((closed.length / issued.length) * 100) : 0,
      amountClosed: closed.reduce((sum, q) => sum + q.amountTtc, 0),
    });
  }

  return rows.sort((a, b) => b.closed - a.closed || b.issued - a.issued);
}
