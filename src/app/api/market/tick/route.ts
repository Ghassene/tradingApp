import { NextResponse } from "next/server";
import { db, marketCandles } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import {
  ALLOWED_PAIRS,
  PAIR_SPECS,
  TIMEFRAMES,
  type ForexPair,
} from "@/lib/forex";
import { ensureSeeded } from "@/lib/seed";

export async function POST() {
  try {
    await ensureSeeded();

    const currentMids: Record<ForexPair, number> = {
      "CHF-EUR": PAIR_SPECS["CHF-EUR"].baselineMid,
      "EUR-TND": PAIR_SPECS["EUR-TND"].baselineMid,
      "CHF-TND": PAIR_SPECS["CHF-TND"].baselineMid,
    };

    for (const pair of ALLOWED_PAIRS) {
      const latest1H = await db
        .select()
        .from(marketCandles)
        .where(
          and(eq(marketCandles.pair, pair), eq(marketCandles.timeframe, "1H"))
        )
        .orderBy(desc(marketCandles.timestamp))
        .limit(1);

      if (latest1H.length > 0) {
        currentMids[pair] = latest1H[0].close;
      }
    }

    const nextMids: Record<ForexPair, number> = {} as Record<ForexPair, number>;
    for (const pair of ["CHF-EUR", "EUR-TND"] as ForexPair[]) {
      const spec = PAIR_SPECS[pair];
      const pullToMean = (spec.baselineMid - currentMids[pair]) * 0.04;
      const shock =
        (Math.random() - 0.5) * spec.pipSize * (pair === "CHF-EUR" ? 4.2 : 11.0);
      nextMids[pair] = Number(
        (currentMids[pair] + pullToMean + shock).toFixed(spec.digits)
      );
    }

    // Keep CHF-TND anchored to triangular cross-rate parity with realistic micro-basis
    const impliedChfTnd = nextMids["CHF-EUR"] * nextMids["EUR-TND"];
    const chfTndPull = (impliedChfTnd - currentMids["CHF-TND"]) * 0.25;
    const chfTndShock = (Math.random() - 0.5) * 0.0001 * 12.0;
    nextMids["CHF-TND"] = Number(
      (currentMids["CHF-TND"] + chfTndPull + chfTndShock).toFixed(4)
    );

    for (const pair of ALLOWED_PAIRS) {
      const nextClose = nextMids[pair];
      for (const tf of TIMEFRAMES) {
        const latestRows = await db
          .select()
          .from(marketCandles)
          .where(
            and(
              eq(marketCandles.pair, pair),
              eq(marketCandles.timeframe, tf)
            )
          )
          .orderBy(desc(marketCandles.timestamp))
          .limit(1);

        if (latestRows.length > 0) {
          const candle = latestRows[0];
          const updatedHigh = Math.max(candle.high, nextClose);
          const updatedLow = Math.min(candle.low, nextClose);
          await db
            .update(marketCandles)
            .set({
              close: nextClose,
              high: updatedHigh,
              low: updatedLow,
              volume: candle.volume + Math.floor(Math.random() * 25 + 5),
            })
            .where(eq(marketCandles.id, candle.id));
        }
      }
    }

    return NextResponse.json({
      mids: nextMids,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/market/tick error:", error);
    return NextResponse.json(
      { error: "Failed to refresh FX rates" },
      { status: 500 }
    );
  }
}
