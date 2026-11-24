import { NextResponse } from "next/server";
import { getRates } from "@/lib/rates";

export const revalidate = 3600;

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.round(days), 1), 365) : 30;
  try {
    return NextResponse.json(await getRates(safeDays));
  } catch {
    return NextResponse.json({ error: "Taux indisponibles" }, { status: 502 });
  }
}
