import { db, marketCandles, rateSnapshots } from "@/db";
import { sql } from "drizzle-orm";
import {
  ALLOWED_PAIRS,
  PAIR_SPECS,
  TIMEFRAMES,
  type ForexPair,
  type Timeframe,
} from "./forex";

let seedPromise: Promise<void> | null = null;

function timeframeStepMs(tf: Timeframe): number {
  switch (tf) {
    case "15M":
      return 15 * 60 * 1000;
    case "1H":
      return 60 * 60 * 1000;
    case "4H":
      return 4 * 60 * 60 * 1000;
    case "1D":
      return 24 * 60 * 60 * 1000;
  }
}

function generateSyntheticCandles(
  pair: ForexPair,
  timeframe: Timeframe,
  count = 72
) {
  const spec = PAIR_SPECS[pair];
  const stepMs = timeframeStepMs(timeframe);
  const now = Date.now();
  const alignedEnd = Math.floor(now / stepMs) * stepMs;

  const pairOffset =
    pair === "CHF-EUR" ? 1.1 : pair === "EUR-TND" ? 2.4 : 3.7;
  const tfMultiplier =
    timeframe === "15M"
      ? 0.45
      : timeframe === "1H"
        ? 1.0
        : timeframe === "4H"
          ? 1.85
          : 3.2;

  const volatility =
    spec.pipSize * (pair === "CHF-EUR" ? 9 : 26) * tfMultiplier;

  const closes: number[] = new Array(count);
  closes[count - 1] = spec.baselineMid;

  for (let i = count - 2; i >= 0; i--) {
    const wave1 = Math.sin((i + pairOffset) * 0.34) * 0.45;
    const wave2 = Math.cos(i * 0.17 + pairOffset * 1.9) * 0.35;
    const micro = Math.sin(i * 1.43 + pairOffset) * 0.28;
    const delta = (wave1 + wave2 + micro) * volatility;
    closes[i] = Number((closes[i + 1] - delta).toFixed(spec.digits));
  }

  const rows: Array<{
    pair: ForexPair;
    timeframe: Timeframe;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const open =
      i === 0
        ? Number((closes[0] - volatility * 0.2).toFixed(spec.digits))
        : closes[i - 1];
    const close = closes[i];
    const wickUp =
      Math.abs(Math.sin(i * 0.91 + pairOffset)) * volatility * 0.85 +
      spec.pipSize * 2;
    const wickDown =
      Math.abs(Math.cos(i * 0.77 + pairOffset)) * volatility * 0.85 +
      spec.pipSize * 2;
    const high = Number(
      (Math.max(open, close) + wickUp).toFixed(spec.digits)
    );
    const low = Number(
      (Math.min(open, close) - wickDown).toFixed(spec.digits)
    );
    const volume = Math.round(
      1100 + Math.abs(Math.sin(i * 0.52 + pairOffset)) * 2800 + (i % 5) * 180
    );

    rows.push({
      pair,
      timeframe,
      timestamp: new Date(alignedEnd - (count - 1 - i) * stepMs),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return rows;
}

async function runSeed() {
  // 1. Seed OHLCV candles if empty
  const existingCandles = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marketCandles);

  if ((existingCandles[0]?.count ?? 0) === 0) {
    const allCandleRows = [];
    for (const pair of ALLOWED_PAIRS) {
      for (const tf of TIMEFRAMES) {
        allCandleRows.push(...generateSyntheticCandles(pair, tf, 72));
      }
    }
    const chunkSize = 200;
    for (let i = 0; i < allCandleRows.length; i += chunkSize) {
      await db
        .insert(marketCandles)
        .values(allCandleRows.slice(i, i + chunkSize));
    }
  }

  // 2. Seed initial public FX rate benchmark snapshots if empty
  const existingSnapshots = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateSnapshots);

  if ((existingSnapshots[0]?.count ?? 0) === 0) {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    await db.insert(rateSnapshots).values([
      {
        label: "SNB Zürich Morning Reference",
        baseCurrency: "CHF",
        amount: 1000,
        chfEurRate: 1.0618,
        eurTndRate: 3.364,
        chfTndRate: 3.5719,
        createdAt: new Date(now - 18 * hour),
      },
      {
        label: "ECB Frankfurt Fixing Benchmark",
        baseCurrency: "EUR",
        amount: 5000,
        chfEurRate: 1.0631,
        eurTndRate: 3.3672,
        chfTndRate: 3.5797,
        createdAt: new Date(now - 6 * hour),
      },
      {
        label: "BCT Tunis Interbank Midday Fix",
        baseCurrency: "TND",
        amount: 10000,
        chfEurRate: 1.0642,
        eurTndRate: 3.3685,
        chfTndRate: 3.5848,
        createdAt: new Date(now - 1 * hour),
      },
    ]);
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
