import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { preorderItems } from "@/lib/db/schema";
import { gte } from "drizzle-orm";

export async function GET() {
  const now = new Date();

  const items = await db
    .select()
    .from(preorderItems)
    .where(gte(preorderItems.releaseDate, now))
    .orderBy(preorderItems.releaseDate);

  const grouped = new Map<string, Array<typeof items[0]>>();
  for (const item of items) {
    if (!grouped.has(item.productName)) grouped.set(item.productName, []);
    grouped.get(item.productName)!.push(item);
  }

  const products = [...grouped.entries()].map(([name, retailers]) => {
    const cheapest = retailers.reduce((a, b) => (Number(a.price) < Number(b.price) ? a : b));
    return {
      name,
      setCode: retailers[0].setCode,
      releaseDate: retailers[0].releaseDate?.toISOString().split("T")[0] ?? null,
      retailers: retailers.map((r) => ({
        name: r.retailer,
        price: Number(r.price),
        currency: r.currency,
        url: r.url,
        inStock: r.inStock,
        isCheapest: r.id === cheapest.id,
      })),
    };
  });

  return NextResponse.json({ products }, {
    headers: { "Cache-Control": "public, s-maxage=600" },
  });
}
