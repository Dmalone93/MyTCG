"use client";

import { useEffect, useState } from "react";
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss";
import { useRegion } from "@/components/region-selector";

type ExtData = {
  card: {
    cid: string;
    name: string;
    type: string;
    color: string;
    cost: number | null;
    power: number | null;
    life: number | null;
    rarity: string;
    traits: string;
    effect: string;
    altArt: string | null;
    setName: string;
    counterPower: number | null;
  };
  synergies: Array<{ cid: string; name: string; imageUrl: string }>;
};

export function CardDataSheet({
  cardCode,
  cardName,
  imageUrl,
  marketPrice,
  rarity,
  cardColor,
  cardType,
  cardCost,
  cardPower,
  setName,
  onClose,
}: {
  cardCode: string;
  cardName: string;
  imageUrl: string;
  marketPrice?: number | null;
  rarity?: string;
  cardColor?: string;
  cardType?: string;
  cardCost?: string;
  cardPower?: string;
  setName?: string;
  onClose: () => void;
}) {
  const swipe = useSwipeDismiss(onClose);
  const { formatPrice } = useRegion();
  const [ext, setExt] = useState<ExtData | null>(null);
  const [extFailed, setExtFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/card-info?code=${encodeURIComponent(cardCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setExt(data);
        else setExtFailed(true);
      })
      .catch(() => setExtFailed(true));
  }, [cardCode]);

  const c = ext?.card;

  // Use extended data if available, otherwise fall back to catalog props
  const displayType = c?.type ?? cardType ?? null;
  const displayColor = c?.color ?? cardColor ?? null;
  const displayRarity = c?.rarity ?? rarity ?? null;
  const displayCost = c?.cost ?? (cardCost ? Number(cardCost) : null);
  const displayPower = c?.power ?? (cardPower ? Number(cardPower) : null);
  const displayLife = c?.life ?? null;
  const displayCounter = c?.counterPower ?? null;
  const displayTraits = c?.traits ?? null;
  const displaySetName = c?.setName ?? setName ?? null;
  const displayEffect = c?.effect ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div
        ref={swipe.sheetRef}
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg min-h-[50vh] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div ref={swipe.handleRef} className="sm:hidden flex justify-center pt-2 pb-1 cursor-grab flex-none">
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex-none">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="font-semibold text-base text-text truncate">{cardName}</h2>
            <div className="font-mono text-sm text-text-dim">{cardCode}</div>
          </div>
          {marketPrice != null && marketPrice > 0 && (
            <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(marketPrice)}</span>
          )}
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none ml-2">×</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Card image + key stats */}
          <div className="flex gap-4 p-4">
            <img
              src={imageUrl}
              alt={cardName}
              className="w-[100px] sm:w-[120px] rounded-lg aspect-[2.5/3.5] object-cover flex-none"
            />
            <div className="flex-1 min-w-0">
              <div className="space-y-2">
                {/* Type / Color / Rarity pills */}
                <div className="flex flex-wrap gap-1.5">
                  {displayType && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{displayType}</span>
                  )}
                  {displayColor && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{displayColor}</span>
                  )}
                  {displayRarity && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{displayRarity}</span>
                  )}
                </div>

                {/* Numeric stats */}
                {(displayCost != null || displayPower != null || displayLife != null || displayCounter != null) && (
                  <div className="flex gap-3">
                    {displayCost != null && (
                      <div>
                        <div className="text-xs text-text-dim">Cost</div>
                        <div className="font-mono text-sm font-semibold text-text">{displayCost}</div>
                      </div>
                    )}
                    {displayPower != null && (
                      <div>
                        <div className="text-xs text-text-dim">Power</div>
                        <div className="font-mono text-sm font-semibold text-text">{displayPower}</div>
                      </div>
                    )}
                    {displayLife != null && (
                      <div>
                        <div className="text-xs text-text-dim">Life</div>
                        <div className="font-mono text-sm font-semibold text-text">{displayLife}</div>
                      </div>
                    )}
                    {displayCounter != null && (
                      <div>
                        <div className="text-xs text-text-dim">Counter</div>
                        <div className="font-mono text-sm font-semibold text-text">{displayCounter}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Traits */}
                {displayTraits && (
                  <div className="text-sm text-text-dim">{displayTraits}</div>
                )}

                {/* Set */}
                {displaySetName && (
                  <div className="text-xs text-text-dim">{displaySetName}</div>
                )}
              </div>
            </div>
          </div>

          {/* Effect text */}
          {displayEffect && (
            <div className="px-4 pb-4">
              <div className="text-xs text-text-dim uppercase tracking-wider mb-1.5">Effect</div>
              <div className="text-sm text-text leading-relaxed bg-bg-surface rounded-xl p-3">
                {displayEffect}
              </div>
            </div>
          )}

          {/* Alt art credit */}
          {c?.altArt && (
            <div className="px-4 pb-3">
              <span className="text-xs text-text-dim">Art by {c.altArt}</span>
            </div>
          )}

          {/* Buy links with logos */}
          <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-4">
            <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Buy this card</div>
            <div className="flex gap-2">
              <a
                href={`https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${cardCode} ${cardName}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors"
              >
                <img src="/logos/ebay.svg" alt="eBay" className="h-[20px]" />
              </a>
              <a
                href={`https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(cardCode)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors"
              >
                <img src="/logos/cardmarket.png" alt="Cardmarket" className="h-[20px]" />
              </a>
              <a
                href={`https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(cardCode)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors"
              >
                <img src="/logos/tcgplayer.svg" alt="TCGplayer" className="h-[20px]" />
              </a>
            </div>
          </div>

          {/* Synergies */}
          {ext && ext.synergies.length > 0 && (
            <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-4">
              <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Synergies</div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {ext.synergies.map((s) => (
                  <div key={s.cid} className="flex-none w-[56px]">
                    <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-[#E4E4E7] mb-1">
                      <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="text-xs text-text-dim truncate">{s.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
