import { NextResponse } from "next/server";
import { db, rateSnapshots } from "@/db";
import { desc } from "drizzle-orm";
import { isAllowedCurrency } from "@/lib/forex";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const items = await db
      .select()
      .from(rateSnapshots)
      .orderBy(desc(rateSnapshots.createdAt), desc(rateSnapshots.id))
      .limit(20);

    return NextResponse.json({ snapshots: items });
  } catch (error) {
    console.error("GET /api/snapshots error:", error);
    return NextResponse.json(
      { error: "Failed to load rate snapshots" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const label =
      String(body?.label ?? "").trim() || "Live FX Reference Snapshot";
    const baseCurrency = body?.baseCurrency ?? "CHF";
    const amount = Number(body?.amount);
    const chfEurRate = Number(body?.chfEurRate);
    const eurTndRate = Number(body?.eurTndRate);
    const chfTndRate = Number(body?.chfTndRate);

    if (!isAllowedCurrency(baseCurrency)) {
      return NextResponse.json(
        { error: "Currency must be CHF, EUR, or TND" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(chfEurRate) ||
      !Number.isFinite(eurTndRate) ||
      !Number.isFinite(chfTndRate)
    ) {
      return NextResponse.json(
        { error: "Valid FX rates are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(rateSnapshots)
      .values({
        label,
        baseCurrency,
        amount,
        chfEurRate: Number(chfEurRate.toFixed(4)),
        eurTndRate: Number(eurTndRate.toFixed(4)),
        chfTndRate: Number(chfTndRate.toFixed(4)),
      })
      .returning();

    return NextResponse.json({ snapshot: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/snapshots error:", error);
    return NextResponse.json(
      { error: "Failed to save rate snapshot" },
      { status: 500 }
    );
  }
}
