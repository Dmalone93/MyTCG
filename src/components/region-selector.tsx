"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type Region = "UK" | "EU" | "US";

type RegionConfig = {
  region: Region;
  currency: string;
  symbol: string;
  rate: number; // Multiplier from USD base
};

const EUR_TO_GBP = 0.86;

const REGIONS: Record<Region, RegionConfig> = {
  US: { region: "US", currency: "USD", symbol: "$", rate: 1 },
  EU: { region: "EU", currency: "EUR", symbol: "€", rate: 0.92 },
  UK: { region: "UK", currency: "GBP", symbol: "£", rate: 0.79 },
};

const RegionContext = createContext<{
  config: RegionConfig;
  setRegion: (r: Region) => void;
  formatPrice: (usdPrice: number | null | undefined) => string;
  formatLocalPrice: (eurPrice: number | null | undefined, usdPrice: number | null | undefined) => string;
}>({
  config: REGIONS.UK,
  setRegion: () => {},
  formatPrice: () => "—",
  formatLocalPrice: () => "—",
});

export function useRegion() {
  return useContext(RegionContext);
}

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region>("UK");

  useEffect(() => {
    const saved = localStorage.getItem("mytcg-region") as Region | null;
    if (saved && saved in REGIONS) setRegionState(saved);
  }, []);

  function setRegion(r: Region) {
    setRegionState(r);
    localStorage.setItem("mytcg-region", r);
  }

  const config = REGIONS[region];

  function formatPrice(usdPrice: number | null | undefined): string {
    if (usdPrice == null || usdPrice <= 0) return "—";
    const converted = usdPrice * config.rate;
    return `${config.symbol}${converted.toFixed(2)}`;
  }

  /** Use real Cardmarket EUR prices for UK/EU, TCGPlayer USD for US */
  function formatLocalPrice(eurPrice: number | null | undefined, usdPrice: number | null | undefined): string {
    if (config.region === "US") {
      if (usdPrice == null || usdPrice <= 0) return "—";
      return `$${usdPrice.toFixed(2)}`;
    }
    if (config.region === "UK") {
      if (eurPrice != null && eurPrice > 0) return `£${(eurPrice * EUR_TO_GBP).toFixed(2)}`;
      if (usdPrice != null && usdPrice > 0) return `£${(usdPrice * config.rate).toFixed(2)}`;
      return "—";
    }
    // EU
    if (eurPrice != null && eurPrice > 0) return `€${eurPrice.toFixed(2)}`;
    if (usdPrice != null && usdPrice > 0) return `€${(usdPrice * config.rate).toFixed(2)}`;
    return "—";
  }

  return (
    <RegionContext value={{ config, setRegion, formatPrice, formatLocalPrice }}>
      {children}
    </RegionContext>
  );
}

export function RegionPicker() {
  const { config, setRegion } = useRegion();

  return (
    <div className="flex gap-0.5 text-xs">
      {(["UK", "EU", "US"] as Region[]).map((r) => (
        <button
          key={r}
          onClick={() => setRegion(r)}
          className={`px-2 py-1 rounded transition-colors ${
            config.region === r
              ? "bg-text text-bg font-semibold"
              : "text-text-dim hover:text-text"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
