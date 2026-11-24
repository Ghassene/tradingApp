// Taux de change réels, quotidiens, depuis l'API publique et gratuite
// "currency-api" (github.com/fawazahmed0/exchange-api), servie par jsDelivr.
// Même source que le site web.

export const PAIRS = ["CHF-EUR", "EUR-TND", "CHF-TND"] as const;
export type Pair = (typeof PAIRS)[number];
export type Currency = "CHF" | "EUR" | "TND";

export const PAIR_INFO: Record<Pair, { base: Currency; quote: Currency; label: string; color: string }> = {
  "CHF-EUR": { base: "CHF", quote: "EUR", label: "Franc suisse → Euro", color: "#60a5fa" },
  "EUR-TND": { base: "EUR", quote: "TND", label: "Euro → Dinar tunisien", color: "#f5b942" },
  "CHF-TND": { base: "CHF", quote: "TND", label: "Franc suisse → Dinar tunisien", color: "#2dd4bf" },
};

export interface DayRates {
  date: string;
  "CHF-EUR": number;
  "EUR-TND": number;
  "CHF-TND": number;
}

const SOURCES = [
  (tag: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/chf.min.json`,
  (tag: string) => `https://${tag}.currency-api.pages.dev/v1/currencies/chf.min.json`,
];

async function fetchDay(tag: string): Promise<DayRates | null> {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url(tag));
      if (!res.ok) continue;
      const json = (await res.json()) as { date: string; chf: Record<string, number> };
      const eur = json.chf?.eur;
      const tnd = json.chf?.tnd;
      if (!eur || !tnd) continue;
      return { date: json.date, "CHF-EUR": eur, "EUR-TND": tnd / eur, "CHF-TND": tnd };
    } catch {
      // source suivante
    }
  }
  return null;
}

export async function getRates(days = 90): Promise<{ latest: DayRates; history: DayRates[] }> {
  const latest = await fetchDay("latest");
  if (!latest) throw new Error("Taux indisponibles");

  const end = new Date(`${latest.date}T00:00:00Z`);
  const tags: string[] = [];
  for (let i = days - 1; i >= 1; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    tags.push(d.toISOString().slice(0, 10));
  }

  // Par paquets de 30 pour ne pas saturer la connexion du téléphone.
  const past: (DayRates | null)[] = [];
  for (let i = 0; i < tags.length; i += 30) {
    past.push(...(await Promise.all(tags.slice(i, i + 30).map(fetchDay))));
  }

  const byDate = new Map<string, DayRates>();
  for (const p of past) if (p) byDate.set(p.date, p);
  byDate.set(latest.date, latest);
  return { latest, history: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export const fmt = (n: number, d = 4) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtDate = (iso: string, long = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
