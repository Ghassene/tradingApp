import { NextResponse } from "next/server";
import { db, marketCandles } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import {
  ALLOWED_PAIRS,
  PAIR_SPECS,
  computeTriangularParity,
  getIndicativeQuotes,
  isAllowedPair,
  isAllowedTimeframe,
  type ForexPair,
  type Timeframe,
} from "@/lib/forex";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSeeded();

    const { searchParams } = new URL(request.url);
    const pairParam = searchParams.get("pair") ?? "CHF-EUR";
    const timeframeParam = searchParams.get("timeframe") ?? "1H";

    if (!isAllowedPair(pairParam)) {
      return NextResponse.json(
        {
          error:
            "Unsupported currency pair. Only CHF-EUR, EUR-TND, and CHF-TND are available.",
        },
        { status: 400 }
      );
    }

    const timeframe: Timeframe = isAllowedTimeframe(timeframeParam)
      ? timeframeParam
      : "1H";

    const selectedCandlesDesc = await db
      .select()
      .from(marketCandles)
      .where(
        and(
          eq(marketCandles.pair, pairParam),
          eq(marketCandles.timeframe, timeframe)
        )
      )
      .orderBy(desc(marketCandles.timestamp))
      .limit(72);

    const candles = [...selectedCandlesDesc].reverse();

    const tickers: Record<
      ForexPair,
      {
        pair: ForexPair;
        name: string;
        base: string;
        quote: string;
        centralBanks: string;
        fixingWindow: string;
        summary: string;
        accentHex: string;
        bid: number;
        ask: number;
        mid: number;
        spreadPips: number;
        high24h: number;
        low24h: number;
        changePct: number;
        changePips: number;
        sparkline: number[];
      }
    > = {} as never;

    const recent1HByPair: Record<ForexPair, typeof selectedCandlesDesc> = {
      "CHF-EUR": [],
      "EUR-TND": [],
      "CHF-TND": [],
    };

    for (const p of ALLOWED_PAIRS) {
      const spec = PAIR_SPECS[p];
      const rowsDesc = await db
        .select()
        .from(marketCandles)
        .where(
          and(eq(marketCandles.pair, p), eq(marketCandles.timeframe, "1H"))
        )
        .orderBy(desc(marketCandles.timestamp))
        .limit(24);

      const rows = [...rowsDesc].reverse();
      recent1HByPair[p] = rows;

      const latest = rows[rows.length - 1];
      const first24 = rows[0] ?? latest;
      const mid = latest ? latest.close : spec.baselineMid;
      const { bid, ask } = getIndicativeQuotes(p, mid);

      const high24h =
        rows.length > 0 ? Math.max(...rows.map((r) => r.high)) : ask;
      const low24h =
        rows.length > 0 ? Math.min(...rows.map((r) => r.low)) : bid;
      const open24 = first24 ? first24.open : mid;
      const changePct =
        open24 > 0 ? Number((((mid - open24) / open24) * 100).toFixed(3)) : 0;
      const changePips = Number(((mid - open24) / spec.pipSize).toFixed(1));

      tickers[p] = {
        pair: p,
        name: spec.name,
        base: spec.base,
        quote: spec.quote,
        centralBanks: spec.centralBanks,
        fixingWindow: spec.fixingWindow,
        summary: spec.summary,
        accentHex: spec.accentHex,
        bid,
        ask,
        mid,
        spreadPips: spec.spreadPips,
        high24h: Number(high24h.toFixed(spec.digits)),
        low24h: Number(low24h.toFixed(spec.digits)),
        changePct,
        changePips,
        sparkline: rows.map((r) => r.close),
      };
    }

    const parityNow = computeTriangularParity(
      tickers["CHF-EUR"].mid,
      tickers["EUR-TND"].mid,
      tickers["CHF-TND"].mid
    );

    const minLen = Math.min(
      recent1HByPair["CHF-EUR"].length,
      recent1HByPair["EUR-TND"].length,
      recent1HByPair["CHF-TND"].length
    );

    const parityHistory = Array.from({ length: minLen }, (_, idx) => {
      const c1 = recent1HByPair["CHF-EUR"][idx];
      const c2 = recent1HByPair["EUR-TND"][idx];
      const c3 = recent1HByPair["CHF-TND"][idx];
      const implied = Number((c1.close * c2.close).toFixed(4));
      const actual = Number(c3.close.toFixed(4));
      const basisPips = Number(((actual - implied) / 0.0001).toFixed(1));
      return {
        timestamp: c3.timestamp,
        actual,
        implied,
        basisPips,
      };
    });

    return NextResponse.json({
      pair: pairParam,
      timeframe,
      updatedAt: new Date().toISOString(),
      tickers,
      candles,
      triangularParity: {
        ...parityNow,
        history: parityHistory,
      },
    });
  } catch (error) {
    console.error("GET /api/market error:", error);
    return NextResponse.json(
      { error: "Failed to load market rates" },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
