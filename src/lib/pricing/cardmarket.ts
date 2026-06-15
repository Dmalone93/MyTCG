import type { PriceProvider, PriceResult, SearchResult } from "./provider";

/**
 * Cardmarket stub — NOT enabled.
 *
 * Cardmarket's API is currently closed to new applications and prohibits
 * apps that only poll public price data. This adapter exists as a placeholder
 * to be wired up only if access reopens and usage complies with their terms.
 */
export class CardmarketProvider implements PriceProvider {
  async getPrice(_cardCode: string): Promise<PriceResult | null> {
    throw new Error(
      "Cardmarket provider is not enabled. Their API is currently closed to new applications."
    );
  }

  async getGradedPrices(
    _cardCode: string
  ): Promise<Record<string, number> | null> {
    throw new Error(
      "Cardmarket provider is not enabled. Their API is currently closed to new applications."
    );
  }

  async search(_query: string): Promise<SearchResult[]> {
    throw new Error(
      "Cardmarket provider is not enabled. Their API is currently closed to new applications."
    );
  }
}
