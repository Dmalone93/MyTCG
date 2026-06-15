import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { watchlist, cardPrices } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * GET /api/watchlist
 * Fetch the authenticated user's watchlist with current prices.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(watchlist.createdAt);

  // Attach current prices
  const cardCodes = items.map((i) => i.cardCode);
  const prices =
    cardCodes.length > 0
      ? await db
          .select()
          .from(cardPrices)
          .where(inArray(cardPrices.cardCode, cardCodes))
      : [];

  const priceMap = new Map(prices.map((p) => [p.cardCode, p]));

  const result = items.map((item) => ({
    ...item,
    currentPrice: priceMap.get(item.cardCode)?.rawMarket ?? null,
    priceFetchedAt: priceMap.get(item.cardCode)?.fetchedAt ?? null,
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/watchlist
 * Add a card to the authenticated user's watchlist.
 * Body: { cardCode, cardName, imageUrl?, targetPrice?, notes? }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cardCode, cardName, imageUrl, targetPrice, notes } = body;

  if (!cardCode || !cardName) {
    return NextResponse.json(
      { error: "cardCode and cardName are required" },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(watchlist)
    .values({
      userId,
      cardCode,
      cardName,
      imageUrl: imageUrl ?? null,
      targetPrice: targetPrice ?? null,
      notes: notes ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: "Card is already on your watchlist" },
      { status: 409 }
    );
  }

  return NextResponse.json(row, { status: 201 });
}

/**
 * DELETE /api/watchlist
 * Remove a card from the authenticated user's watchlist.
 * Body: { cardCode }
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cardCode } = body;

  if (!cardCode) {
    return NextResponse.json(
      { error: "cardCode is required" },
      { status: 400 }
    );
  }

  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.cardCode, cardCode)));

  return NextResponse.json({ success: true });
}
