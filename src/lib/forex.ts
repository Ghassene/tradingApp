import {
  ALLOWED_CURRENCIES,
  ALLOWED_PAIRS,
  type CurrencyCode,
  type ForexPair,
} from "@/db/schema";

export { ALLOWED_PAIRS, ALLOWED_CURRENCIES, type ForexPair, type CurrencyCode };

export const TIMEFRAMES = ["15M", "1H", "4H", "1D"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface PairSpecification {
  pair: ForexPair;
  base: CurrencyCode;
  quote: CurrencyCode;
  name: string;
  centralBanks: string;
  fixingWindow: string;
  digits: number;
  pipSize: number;
  spreadPips: number;
  baselineMid: number;
  accentHex: string;
  summary: string;
}

export const PAIR_SPECS: Record<ForexPair, PairSpecification> = {
  "CHF-EUR": {
    pair: "CHF-EUR",
    base: "CHF",
    quote: "EUR",
    name: "Swiss Franc / Euro",
    centralBanks: "SNB · ECB",
    fixingWindow: "Zurich · Frankfurt 14:15 CET",
    digits: 4,
    pipSize: 0.0001,
    spreadPips: 1.4,
    baselineMid: 1.0642,
    accentHex: "#1D4ED8",
    summary:
      "Primary Alpine-Eurozone exchange benchmark reflecting SNB safe-haven flows and ECB rate differentials.",
  },
  "EUR-TND": {
    pair: "EUR-TND",
    base: "EUR",
    quote: "TND",
    name: "Euro / Tunisian Dinar",
    centralBanks: "ECB · BCT",
    fixingWindow: "Tunis BCT Interbank 11:30 CET",
    digits: 4,
    pipSize: 0.0001,
    spreadPips: 18.0,
    baselineMid: 3.3685,
    accentHex: "#059669",
    summary:
      "Core Mediterranean trade and remittance pair anchored by Banque Centrale de Tunisie basket management.",
  },
  "CHF-TND": {
    pair: "CHF-TND",
    base: "CHF",
    quote: "TND",
    name: "Swiss Franc / Tunisian Dinar",
    centralBanks: "SNB · BCT Cross",
    fixingWindow: "Helvetia · Maghreb Cross Fixing",
    digits: 4,
    pipSize: 0.0001,
    spreadPips: 21.0,
    baselineMid: 3.5848,
    accentHex: "#7C3AED",
    summary:
      "Synthetic and direct cross-rate linking Swiss Franc purchasing power to the Tunisian Dinar.",
  },
};

export const CURRENCY_META: Record<
  CurrencyCode,
  {
    code: CurrencyCode;
    symbol: string;
    name: string;
    centralBank: string;
    jurisdiction: string;
    policyRate: string;
    fixingNote: string;
  }
> = {
  CHF: {
    code: "CHF",
    symbol: "Fr.",
    name: "Swiss Franc",
    centralBank: "Swiss National Bank (SNB)",
    jurisdiction: "Switzerland & Liechtenstein",
    policyRate: "0.50%",
    fixingNote: "Zürich Interbank Reference · Low-inflation safe-haven anchor",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    centralBank: "European Central Bank (ECB)",
    jurisdiction: "Eurozone (20 Member States)",
    policyRate: "2.50%",
    fixingNote: "ECB Daily Reference Fixing at 16:00 CET · Primary TND basket weight",
  },
  TND: {
    code: "TND",
    symbol: "DT",
    name: "Tunisian Dinar",
    centralBank: "Banque Centrale de Tunisie (BCT)",
    jurisdiction: "Republic of Tunisia",
    policyRate: "7.50%",
    fixingNote: "BCT Managed Float · Weighted against EUR & USD trade basket",
  },
};

export function isAllowedPair(value: unknown): value is ForexPair {
  return (
    typeof value === "string" &&
    (ALLOWED_PAIRS as readonly string[]).includes(value)
  );
}

export function isAllowedCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (ALLOWED_CURRENCIES as readonly string[]).includes(value)
  );
}

export function isAllowedTimeframe(value: unknown): value is Timeframe {
  return (
    typeof value === "string" &&
    (TIMEFRAMES as readonly string[]).includes(value)
  );
}

export function formatRate(pair: ForexPair, rate: number): string {
  const digits = PAIR_SPECS[pair]?.digits ?? 4;
  return rate.toFixed(digits);
}

export function getIndicativeQuotes(pair: ForexPair, mid: number) {
  const spec = PAIR_SPECS[pair];
  const halfSpread = (spec.spreadPips * spec.pipSize) / 2;
  const bid = Number((mid - halfSpread).toFixed(spec.digits));
  const ask = Number((mid + halfSpread).toFixed(spec.digits));
  return {
    bid,
    ask,
    mid: Number(mid.toFixed(spec.digits)),
    spreadPips: spec.spreadPips,
  };
}

export function computeTriangularParity(
  chfEurMid: number,
  eurTndMid: number,
  chfTndMid: number
) {
  const impliedChfTnd = Number((chfEurMid * eurTndMid).toFixed(4));
  const basisDiff = chfTndMid - impliedChfTnd;
  const basisPips = Number((basisDiff / 0.0001).toFixed(1));
  return {
    impliedChfTnd,
    actualChfTnd: Number(chfTndMid.toFixed(4)),
    basisPips,
    alignmentStatus:
      Math.abs(basisPips) >= 12
        ? basisPips > 0
          ? "Direct CHF-TND +Premium"
          : "Direct CHF-TND -Discount"
        : "Cross Parity Aligned",
  };
}

export function convertAllCurrencies(
  amount: number,
  base: CurrencyCode,
  rates: { chfEur: number; eurTnd: number; chfTnd: number }
): Record<CurrencyCode, number> {
  const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;

  if (base === "CHF") {
    return {
      CHF: safeAmount,
      EUR: Number((safeAmount * rates.chfEur).toFixed(4)),
      TND: Number((safeAmount * rates.chfTnd).toFixed(4)),
    };
  }

  if (base === "EUR") {
    const chf = rates.chfEur > 0 ? safeAmount / rates.chfEur : 0;
    return {
      CHF: Number(chf.toFixed(4)),
      EUR: safeAmount,
      TND: Number((safeAmount * rates.eurTnd).toFixed(4)),
    };
  }

  // base === "TND"
  const chf = rates.chfTnd > 0 ? safeAmount / rates.chfTnd : 0;
  const eur = rates.eurTnd > 0 ? safeAmount / rates.eurTnd : 0;
  return {
    CHF: Number(chf.toFixed(4)),
    EUR: Number(eur.toFixed(4)),
    TND: safeAmount,
  };
}
