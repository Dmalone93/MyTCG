import type { Listing, ListingProvider } from "./types";

export class MockListingProvider implements ListingProvider {
  async getListings(cardCode: string, cardName?: string, grade?: string): Promise<Listing[]> {
    await new Promise((r) => setTimeout(r, 200));

    const basePrice = this.hashPrice(cardCode);
    const isGraded = grade && grade !== "Raw";
    const multiplier = isGraded ? 1.8 + Math.random() * 1.2 : 1;

    return [
      {
        source: "ebay",
        price: +(basePrice * multiplier * (0.85 + Math.random() * 0.3)).toFixed(2),
        currency: "GBP",
        condition: isGraded ? `${grade}` : "Near Mint",
        shipping: +(1.5 + Math.random() * 2.5).toFixed(2),
        url: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${cardCode}${cardName ? ` ${cardName}` : ""}`)}`,
        soldDate: null,
      },
      {
        source: "ebay",
        price: +(basePrice * multiplier * (0.9 + Math.random() * 0.25)).toFixed(2),
        currency: "GBP",
        condition: isGraded ? `${grade}` : "Lightly Played",
        shipping: 0,
        url: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${cardCode}${cardName ? ` ${cardName}` : ""}`)}`,
        soldDate: null,
      },
      {
        source: "cardmarket",
        price: +(basePrice * multiplier * (0.88 + Math.random() * 0.2) * 1.17).toFixed(2),
        currency: "EUR",
        condition: isGraded ? `${grade}` : "Near Mint",
        shipping: +(2.0 + Math.random() * 3).toFixed(2),
        url: `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(cardCode)}`,
        soldDate: null,
      },
      {
        source: "tcgplayer",
        price: +(basePrice * multiplier * (0.92 + Math.random() * 0.18) * 1.27).toFixed(2),
        currency: "USD",
        condition: isGraded ? `${grade}` : "Near Mint",
        url: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(cardCode)}`,
        soldDate: null,
      },
    ];
  }

  private hashPrice(code: string): number {
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
    return 2 + Math.abs(hash % 500) / 10;
  }
}
