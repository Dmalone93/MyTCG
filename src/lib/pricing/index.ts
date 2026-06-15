import type { PriceProvider } from "./provider";
import { PriceChartingProvider } from "./pricecharting";

export type { PriceProvider, PriceResult, SearchResult } from "./provider";

/** Returns the active pricing provider. Currently PriceCharting. */
export function getPriceProvider(): PriceProvider {
  return new PriceChartingProvider();
}
