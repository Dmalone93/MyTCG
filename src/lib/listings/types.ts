export interface Listing {
  source: "ebay" | "cardmarket" | "tcgplayer";
  price: number;
  currency: "GBP" | "EUR" | "USD";
  condition: string;
  shipping?: number;
  url: string;
  soldDate?: string | null;
}

export interface ListingProvider {
  getListings(cardCode: string, cardName?: string, grade?: string): Promise<Listing[]>;
}
