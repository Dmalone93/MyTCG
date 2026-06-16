import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { intelItems } from "@/lib/db/schema";
import { getExtendedCards } from "@/lib/catalog/extended-cards";

const CATEGORIES = [
  {
    key: "new_sets",
    query: "One Piece TCG new set release date 2026 booster pack announcement OP-11 OP-12 OP-13 English release schedule",
    prompt: "Find the latest news about upcoming One Piece TCG set releases — both Japanese and English. Include confirmed release dates, set names, and any revealed card lists or themes. Prioritize English release dates.",
  },
  {
    key: "preorders_uk",
    query: "One Piece TCG pre-order UK buy booster box 2026 site:totalcards.net OR site:chaoscards.co.uk OR site:magicmadhouse.co.uk OR site:cardmarket.com OR site:tcgplayer.com",
    prompt: "Find where to pre-order or buy the latest One Piece TCG products in the UK. Include specific product names, prices in GBP/EUR, retailer names, and links. Focus on UK-based retailers like Total Cards, Chaos Cards, Magic Madhouse, or Card Market.",
  },
  {
    key: "top_cards",
    query: "One Piece TCG most expensive cards 2026 price list top value secret rare alt art",
    prompt: "Find the current most expensive One Piece TCG cards and any recent price spikes or drops. Include specific card codes (e.g. OP05-119), card names, current market prices, and why they're valuable. Focus on English market prices.",
  },
  {
    key: "trending",
    query: "One Piece TCG trending cards rising value 2026 popular deck meta tournament results",
    prompt: "Find which One Piece TCG cards are gaining traction right now — rising in price, being played in winning decks, or getting social media buzz. Include specific card names/codes and why they're trending.",
  },
  {
    key: "promos",
    query: "One Piece TCG promo card 2026 exclusive event promo tournament prize regional championship",
    prompt: "Find information about upcoming or recently released One Piece TCG promo cards — event promos, tournament prizes, store exclusives, magazine promos, winner cards. Include how to obtain them and their estimated value.",
  },
  {
    key: "tournaments",
    query: "One Piece TCG tournament UK Europe 2026 regional championship local event store",
    prompt: "Find upcoming One Piece TCG tournaments and events in the UK and Europe. Include dates, locations, registration links, format (constructed/sealed), and any exclusive promo cards available at the events. Also include online tournaments if relevant.",
  },
  {
    key: "deals",
    query: "One Piece TCG deal discount sale UK 2026 cheap booster box singles",
    prompt: "Find any current deals, discounts, or sales on One Piece TCG products in the UK — discounted booster boxes, singles sales, bundle deals, or clearance items. Include prices and where to buy.",
  },
];

type IntelResult = {
  category: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  author: string;
  image_url: string;
  published: string;
  urgent: boolean;
  jp_only: boolean;
  card_names: string[];
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const cronAuth = secret && authHeader === `Bearer ${secret}`;

  if (!cronAuth) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const allResults: IntelResult[] = [];
  const errors: string[] = [];

  for (const cat of CATEGORIES) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{
          role: "user",
          content: `Search the web for: ${cat.query}

${cat.prompt}

IMPORTANT: Only include information from the last 6 weeks. Do NOT include anything older than 6 weeks. Today's date is ${new Date().toISOString().split("T")[0]}.

You are writing for a One Piece TCG collector newsletter. Write like a journalist — be specific, factual, and tell the reader WHY this matters and WHAT they should do about it.

Return ONLY a JSON array of news items (max 4). Each item must have these fields:
- "title": string (newspaper-quality headline — specific and informative, e.g. "OP-17 English Release Confirmed for August 15" not "New Set Coming")
- "summary": string (3-4 sentences. First sentence is the key fact. Then context/details. End with what this means for collectors — should they buy, sell, wait, pre-order?)
- "source": string (site name e.g. "Total Cards", "Reddit", "Bandai")
- "source_url": string (full URL to the article/post/listing)
- "author": string (username or author name, or "" if unknown)
- "image_url": string (URL to a relevant image, or "" if none)
- "published": string (date like "2026-06-14")
- "urgent": boolean (true only if collectors need to act within 48 hours)
- "jp_only": boolean (true if Japan-only content)
- "card_names": string[] (specific card codes like "OP13-001" or card names)

Write headlines like a newspaper. Summaries should answer: What happened? Why does it matter? What should I do?
Return ONLY the JSON array, no other text.`,
        }],
      });

      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const items: IntelResult[] = JSON.parse(jsonMatch[0]).map(
          (item: Record<string, unknown>) => ({
            category: cat.key,
            title: String(item.title ?? "").slice(0, 500),
            summary: String(item.summary ?? "").slice(0, 2000),
            source: String(item.source ?? ""),
            source_url: String(item.source_url ?? ""),
            author: String(item.author ?? ""),
            image_url: String(item.image_url ?? ""),
            published: String(item.published ?? ""),
            urgent: Boolean(item.urgent),
            jp_only: Boolean(item.jp_only),
            card_names: Array.isArray(item.card_names) ? item.card_names.map(String) : [],
          })
        );
        allResults.push(...items);
      }
    } catch (err) {
      errors.push(`${cat.key}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Enrich with card images from extended DB when image_url is empty
  const extCards = getExtendedCards();
  for (const item of allResults) {
    if (!item.image_url && item.card_names.length > 0) {
      // Find a card image for the first mentioned card
      for (const name of item.card_names) {
        const match = extCards.find(
          (c) => c.cid.toUpperCase() === name.toUpperCase() ||
                 c.name.toLowerCase() === name.toLowerCase()
        );
        if (match?.imageUrl) {
          item.image_url = match.imageUrl;
          break;
        }
      }
    }
    // If still no image, try to find any card mentioned in the title/summary
    if (!item.image_url) {
      const text = `${item.title} ${item.summary}`.toUpperCase();
      const codeMatch = text.match(/(OP|ST|EB)\d{2}-\d{3}/);
      if (codeMatch) {
        const card = extCards.find((c) => c.cid.toUpperCase() === codeMatch[0]);
        if (card?.imageUrl) item.image_url = card.imageUrl;
      }
    }
  }

  let inserted = 0;
  const seen = new Set<string>();

  for (const item of allResults) {
    if (!item.title || seen.has(item.title)) continue;
    seen.add(item.title);

    try {
      await db
        .insert(intelItems)
        .values({
          category: item.category,
          title: item.title,
          summary: item.summary,
          source: item.source,
          sourceUrl: item.source_url || null,
          author: item.author || null,
          imageUrl: item.image_url || null,
          published: item.published,
          urgent: item.urgent,
          jpOnly: item.jp_only,
          cardNames: item.card_names,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: intelItems.title,
          set: {
            summary: item.summary,
            source: item.source,
            sourceUrl: item.source_url || null,
            author: item.author || null,
            imageUrl: item.image_url || null,
            published: item.published,
            urgent: item.urgent,
            jpOnly: item.jp_only,
            cardNames: item.card_names,
            fetchedAt: new Date(),
          },
        });
      inserted++;
    } catch {
      // duplicate or other error — skip
    }
  }

  return NextResponse.json({
    message: `Scanned ${CATEGORIES.length} categories, inserted/updated ${inserted} items`,
    inserted,
    total: allResults.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
