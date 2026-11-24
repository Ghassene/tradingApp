// Taux de change réels, quotidiens, depuis l'API publique et gratuite
// "currency-api" (github.com/fawazahmed0/exchange-api), servie par jsDelivr.
// Elle couvre le dinar tunisien (TND), contrairement à la BCE.

export const PAIRS = ["CHF-EUR", "EUR-TND", "CHF-TND"] as const;
export type Pair = (typeof PAIRS)[number];
export type Currency = "CHF" | "EUR" | "TND";

export const PAIR_INFO: Record<Pair, { base: Currency; quote: Currency; label: string }> = {
  "CHF-EUR": { base: "CHF", quote: "EUR", label: "Franc suisse → Euro" },
  "EUR-TND": { base: "EUR", quote: "TND", label: "Euro → Dinar tunisien" },
  "CHF-TND": { base: "CHF", quote: "TND", label: "Franc suisse → Dinar tunisien" },
};

export interface DayRates {
  date: string; // AAAA-MM-JJ
  "CHF-EUR": number;
  "EUR-TND": number;
  "CHF-TND": number;
}

export interface RatesPayload {
  source: string;
  latest: DayRates;
  history: DayRates[]; // du plus ancien au plus récent
  fetchedAt: string;
}

const SOURCES = [
  (tag: string) =>
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/chf.min.json`,
  (tag: string) => `https://${tag}.currency-api.pages.dev/v1/currencies/chf.min.json`,
];

async function fetchDay(tag: string): Promise<DayRates | null> {
  // Une date passée ne change plus : on la garde en cache longtemps.
  const revalidate = tag === "latest" ? 3600 : 60 * 60 * 24 * 30;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url(tag), { next: { revalidate } });
      if (!res.ok) continue;
      const json = (await res.json()) as { date: string; chf: Record<string, number> };
      const eur = json.chf?.eur;
      const tnd = json.chf?.tnd;
      if (!eur || !tnd) continue;
      return {
        date: json.date,
        "CHF-EUR": eur,
        "EUR-TND": tnd / eur,
        "CHF-TND": tnd,
      };
    } catch {
      // essaie la source suivante
    }
  }
  return null;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getRates(days = 90): Promise<RatesPayload> {
  const latest = await fetchDay("latest");
  if (!latest) throw new Error("Impossible de récupérer les taux de change");

  const end = new Date(`${latest.date}T00:00:00Z`);
  const tags: string[] = [];
  for (let i = days - 1; i >= 1; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    tags.push(isoDay(d));
  }

  const past = await Promise.all(tags.map(fetchDay));
  const byDate = new Map<string, DayRates>();
  for (const p of past) if (p) byDate.set(p.date, p);
  byDate.set(latest.date, latest);

  const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    source: "currency-api (fawazahmed0) · taux quotidiens",
    latest,
    history,
    fetchedAt: new Date().toISOString(),
  };
}
