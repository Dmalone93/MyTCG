export type PriceResult = {
  cardCode: string;
  rawMarket: number | null;
  gradedPrices: Record<string, number>;
  currency: string;
};

export type SearchResult = {
  id: string;
  name: string;
  cardCode: string;
  imageUrl?: string;
};

export interface PriceProvider {
  /** Get the current market price and graded prices for a card */
  getPrice(cardCode: string): Promise<PriceResult | null>;

  /** Get graded prices specifically (PSA 8, 9, 10 etc.) */
  getGradedPrices(cardCode: string): Promise<Record<string, number> | null>;

  /** Search for cards by query string */
  search(query: string): Promise<SearchResult[]>;
}
