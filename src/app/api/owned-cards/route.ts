import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { collectionCards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/owned-cards — returns set of card codes the user owns */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json([]);

    const cards = await db.select({ cardCode: collectionCards.cardCode })
      .from(collectionCards)
      .where(eq(collectionCards.userId, userId));

    const codes = [...new Set(cards.map((c) => c.cardCode))];
    return NextResponse.json(codes, {
      headers: { "Cache-Control": "private, s-maxage=60" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
