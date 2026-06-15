import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPriceProvider } from "@/lib/pricing";

/**
 * POST /api/refresh-prices
 *
 * Refreshes cached prices for all card_codes currently in any collection.
 * Protected by CRON_SECRET bearer token — call from Vercel cron or manually.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const provider = getPriceProvider();

  // Get all distinct card_codes across all collections
  const { data: cards, error } = await supabase
    .from("collection_cards")
    .select("card_code");

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch card codes", detail: error.message },
      { status: 500 }
    );
  }

  const codes = [...new Set((cards ?? []).map((c) => c.card_code))];

  if (codes.length === 0) {
    return NextResponse.json({ message: "No cards to refresh", updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const code of codes) {
    try {
      const result = await provider.getPrice(code);
      if (!result) {
        errors.push(`${code}: no result`);
        continue;
      }

      const { error: upsertError } = await supabase
        .from("card_prices")
        .upsert(
          {
            card_code: code,
            raw_market: result.rawMarket,
            graded_prices: result.gradedPrices,
            currency: result.currency,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "card_code" }
        );

      if (upsertError) {
        errors.push(`${code}: ${upsertError.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      errors.push(
        `${code}: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }

    // Rate limit: small delay between requests
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({
    message: `Refreshed ${updated}/${codes.length} prices`,
    updated,
    total: codes.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
