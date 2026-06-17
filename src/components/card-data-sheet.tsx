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
  onClose,
}: {
  cardCode: string;
  cardName: string;
  imageUrl: string;
  marketPrice?: number | null;
  onClose: () => void;
}) {
  const swipe = useSwipeDismiss(onClose);
  const { formatPrice } = useRegion();
  const [ext, setExt] = useState<ExtData | null>(null);

  useEffect(() => {
    fetch(`/api/card-info?code=${encodeURIComponent(cardCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setExt(data); })
      .catch(() => {});
  }, [cardCode]);

  const c = ext?.card;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div
        ref={swipe.sheetRef}
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg min-h-[50vh] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div ref={swipe.handleRef} className="sm:hidden flex justify-center pt-2 pb-1 cursor-grab">
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="font-semibold text-base text-text truncate">{cardName}</h2>
            <div className="font-mono text-sm text-text-dim">{cardCode}</div>
          </div>
          {marketPrice != null && marketPrice > 0 && (
            <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(marketPrice)}</span>
          )}
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none ml-2">×</button>
        </div>

        {/* Card image + key stats */}
        <div className="flex gap-4 p-4">
          <img
            src={imageUrl}
            alt={cardName}
            className="w-[100px] sm:w-[120px] rounded-lg aspect-[2.5/3.5] object-cover flex-none"
          />
          <div className="flex-1 min-w-0">
            {/* Quick stats */}
            {c ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {c.type && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{c.type}</span>
                  )}
                  {c.color && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{c.color}</span>
                  )}
                  {c.rarity && (
                    <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{c.rarity}</span>
                  )}
                </div>

                {/* Numeric stats */}
                <div className="flex gap-3">
                  {c.cost != null && (
                    <div>
                      <div className="text-xs text-text-dim">Cost</div>
                      <div className="font-mono text-sm font-semibold text-text">{c.cost}</div>
                    </div>
                  )}
                  {c.power != null && (
                    <div>
                      <div className="text-xs text-text-dim">Power</div>
                      <div className="font-mono text-sm font-semibold text-text">{c.power}</div>
                    </div>
                  )}
                  {c.life != null && (
                    <div>
                      <div className="text-xs text-text-dim">Life</div>
                      <div className="font-mono text-sm font-semibold text-text">{c.life}</div>
                    </div>
                  )}
                  {c.counterPower != null && (
                    <div>
                      <div className="text-xs text-text-dim">Counter</div>
                      <div className="font-mono text-sm font-semibold text-text">{c.counterPower}</div>
                    </div>
                  )}
                </div>

                {/* Traits */}
                {c.traits && (
                  <div className="text-sm text-text-dim">{c.traits}</div>
                )}

                {/* Set */}
                {c.setName && (
                  <div className="text-xs text-text-dim">{c.setName}</div>
                )}
              </div>
            ) : (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-20 bg-[#E4E4E7] rounded" />
                <div className="h-4 w-32 bg-[#E4E4E7] rounded" />
                <div className="h-4 w-24 bg-[#E4E4E7] rounded" />
              </div>
            )}
          </div>
        </div>

        {/* Effect text */}
        {c?.effect && (
          <div className="px-4 pb-4">
            <div className="text-xs text-text-dim uppercase tracking-wider mb-1.5">Effect</div>
            <div className="text-sm text-text leading-relaxed bg-bg-surface rounded-xl p-3">
              {c.effect}
            </div>
          </div>
        )}

        {/* Alt art credit */}
        {c?.altArt && (
          <div className="px-4 pb-3">
            <span className="text-xs text-text-dim">Art by {c.altArt}</span>
          </div>
        )}

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
  );
}
