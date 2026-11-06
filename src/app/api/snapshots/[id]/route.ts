import { NextResponse } from "next/server";
import { db, rateSnapshots } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid snapshot ID" }, { status: 400 });
    }

    await db.delete(rateSnapshots).where(eq(rateSnapshots.id, numericId));
    return NextResponse.json({ ok: true, id: numericId });
  } catch (error) {
    console.error("DELETE /api/snapshots/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}
