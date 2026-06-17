import { db } from "@/lib/db";
import { collections, collectionCards, cardPrices } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch the collection
  const [collection] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);

  if (!collection) {
    notFound();
  }

  // Fetch all cards in the collection
  const cards = await db
    .select()
    .from(collectionCards)
    .where(eq(collectionCards.collectionId, id));

  // Fetch prices for all cards
  const cardCodes = [...new Set(cards.map((c) => c.cardCode))];
  const prices =
    cardCodes.length > 0
      ? await db
          .select()
          .from(cardPrices)
          .where(inArray(cardPrices.cardCode, cardCodes))
      : [];

  const priceMap = new Map(prices.map((p) => [p.cardCode, p]));

  // Compute per-card value and total
  const cardsWithValue = cards.map((card) => {
    const price = priceMap.get(card.cardCode);
    const unitPrice = price?.rawMarket ? parseFloat(price.rawMarket) : 0;
    const value = unitPrice * (card.quantity ?? 1);
    return { ...card, unitPrice, value };
  });

  const totalCards = cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0);
  const totalValue = cardsWithValue.reduce((sum, c) => sum + c.value, 0);

  // Top 12 cards by value
  const topCards = [...cardsWithValue]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const formatPrice = (n: number) =>
    n > 0
      ? n.toLocaleString("en-GB", { style: "currency", currency: "GBP" })
      : "—";

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-text-dim mb-2">
          MyTCG Collection
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text mb-4">
          {collection.name}
        </h1>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-black/5">
            <p className="text-xs text-text-dim mb-0.5">Total cards</p>
            <p className="text-lg font-semibold text-text">{totalCards}</p>
          </div>
          <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-black/5">
            <p className="text-xs text-text-dim mb-0.5">Est. value</p>
            <p className="text-lg font-semibold" style={{ color: "#059669" }}>
              {formatPrice(totalValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Top cards grid */}
      {topCards.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-4">
            Top cards
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {topCards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/5 flex flex-col"
              >
                {card.imageUrl ? (
                  <div className="aspect-[3/4] bg-bg-surface overflow-hidden">
                    <img
                      src={card.imageUrl}
                      alt={card.cardName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-[3/4] bg-bg-surface flex items-center justify-center">
                    <span className="text-text-dim text-xs">No image</span>
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <p className="text-sm font-medium text-text leading-tight line-clamp-2">
                    {card.cardName}
                  </p>
                  <p className="text-xs text-text-dim font-mono">{card.cardCode}</p>
                  {card.unitPrice > 0 && (
                    <p
                      className="text-sm font-semibold mt-auto"
                      style={{ color: "#059669" }}
                    >
                      {formatPrice(card.unitPrice)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-text-dim text-base py-12 text-center">
          This collection has no cards yet.
        </p>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-black/5 flex items-center justify-between">
        <p className="text-xs text-text-dim">
          Shared via{" "}
          <a
            href="https://mytcg-dmalone93s-projects.vercel.app"
            className="text-text-muted underline underline-offset-2 hover:text-text transition-colors"
          >
            MyTCG
          </a>
        </p>
        <a
          href="https://mytcg-dmalone93s-projects.vercel.app"
          className="text-xs text-text-dim hover:text-text transition-colors"
        >
          Powered by MyTCG
        </a>
      </div>
    </div>
  );
}
