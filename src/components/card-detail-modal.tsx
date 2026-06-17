"use client";

import { useState, useEffect } from "react";
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss";
import type { CollectionCard, CardPrice } from "./collection-shell";
import { PriceChart } from "@/lib/charts/price-chart";
import { LivePriceBadge } from "@/components/live-price-badge";
import { GradingROI } from "@/components/grading-roi";
import { useRegion } from "@/components/region-selector";

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

const GRADE_ORDER = ["PSA 10", "PSA 9", "PSA 8", "BGS 10", "BGS 9.5", "CGC 10", "CGC 9.5", "Graded"];

type ExtData = {
  card: {
    type: string; color: string; cost: number | null; power: number | null;
    life: number | null; rarity: string; traits: string; effect: string;
    altArt: string | null; setName: string; counterPower: number | null;
  };
  synergies: Array<{ cid: string; name: string; imageUrl: string }>;
};

export function CardDetailModal({
  card, price, onClose, onUpdate, onDelete,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { formatPrice } = useRegion();
  const swipe = useSwipeDismiss(onClose);
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(card.quantity ?? 1);
  const [condition, setCondition] = useState(card.condition ?? "NM");
  const [isGraded, setIsGraded] = useState(card.isGraded ?? false);
  const [grade, setGrade] = useState(card.grade ?? "");
  const [gradedCompany, setGradedCompany] = useState(card.gradedCompany ?? "");
  const [acquiredPrice, setAcquiredPrice] = useState(card.acquiredPrice ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<ExtData | null>(null);

  useEffect(() => {
    setExt(null);
    fetch(`/api/card-info?code=${encodeURIComponent(card.cardCode)}`)
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then((data) => { if (data?.card) setExt(data); })
      .catch(() => {
        const alt = card.cardCode.toUpperCase().replace(/\s/g, "");
        if (alt !== card.cardCode) {
          fetch(`/api/card-info?code=${encodeURIComponent(alt)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.card) setExt(data); })
            .catch(() => {});
        }
      });
  }, [card.cardCode]);

  const market = num(price?.rawMarket);
  const paid = num(card.acquiredPrice);
  const pl = market > 0 && paid > 0 ? (market - paid) * (card.quantity ?? 1) : null;
  const plColor = pl != null ? (pl >= 0 ? "#059669" : "#DC2626") : undefined;
  const gradedPrices = (price?.gradedPrices as Record<string, number> | null) ?? {};
  const sortedGrades = GRADE_ORDER.filter((g) => g in gradedPrices);
  const c = ext?.card;

  async function handleSave() {
    setSaving(true);
    await onUpdate(card.id, { quantity, condition, isGraded, grade: grade || null, gradedCompany: gradedCompany || null, acquiredPrice: acquiredPrice || null, notes: notes || null });
    setSaving(false);
    setEditing(false);
  }

  const inputClass = "bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-lg px-3 py-2.5 text-sm text-text focus:outline-2 focus:outline-accent";

  const dataRows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Type", value: c?.traits },
    { label: "Category", value: c?.type },
    { label: "Product", value: c?.setName },
    { label: "Color", value: c?.color },
    { label: "Rarity", value: c?.rarity },
    { label: "Cost", value: c?.cost != null ? String(c.cost) : null },
    { label: "Power", value: c?.power != null ? String(c.power) : null },
    { label: "Counter", value: c?.counterPower != null ? String(c.counterPower) : null },
    { label: "Life", value: c?.life != null ? String(c.life) : null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div
        ref={swipe.ref}
        className="relative bg-bg-elevated rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        {...swipe.handlers}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Sticky header with actions */}
        <div className="flex-none flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="font-semibold text-base text-text truncate flex-1">{card.cardName}</h2>
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="text-sm font-medium text-text-muted hover:text-text active:opacity-70 px-2.5 py-1.5 rounded-lg hover:bg-bg-surface transition-colors">
                Edit
              </button>
              <button
                onClick={async () => { if (confirm(`Delete "${card.cardName}"?`)) { await onDelete(card.id); onClose(); } }}
                className="text-sm font-medium text-red-400 hover:text-red-500 active:opacity-70 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          )}
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none ml-1">×</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!editing ? (
            <>
              {/* Image + prices */}
              <div className="flex gap-4 p-4 sm:p-5">
                {card.imageUrl && (
                  <img src={card.imageUrl} alt={card.cardName} className="w-[100px] sm:w-[140px] rounded-lg aspect-[2.5/3.5] object-cover flex-none" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-text-dim mb-1">{card.cardCode}</div>
                  <div className="text-sm text-text-dim mb-3">
                    {card.quantity ?? 1}× · {card.condition ?? "—"}{card.isGraded ? ` · ${card.gradedCompany} ${card.grade}` : ""}
                  </div>

                  {market > 0 && (
                    <div className="mb-1">
                      <span className="text-xs text-text-dim uppercase tracking-wider">Market</span>
                      <div className="font-mono text-lg font-semibold text-[#059669]">{formatPrice(market)}</div>
                    </div>
                  )}
                  {paid > 0 && (
                    <div className="mb-1">
                      <span className="text-xs text-text-dim uppercase tracking-wider">Paid</span>
                      <div className="font-mono text-sm text-text">{formatPrice(paid)}</div>
                    </div>
                  )}
                  {pl != null && (
                    <div>
                      <span className="text-xs text-text-dim uppercase tracking-wider">P/L</span>
                      <div className="font-mono text-sm font-semibold" style={{ color: plColor }}>{pl >= 0 ? "+" : ""}{formatPrice(pl)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Data rows */}
              <div className="border-t border-[rgba(0,0,0,0.06)]">
                {dataRows.map((row) => {
                  if (!row.value) return null;
                  return (
                    <div key={row.label} className="flex border-b border-[rgba(0,0,0,0.04)]">
                      <div className="w-[90px] sm:w-[120px] flex-none px-4 sm:px-5 py-2.5 text-sm text-text-dim">{row.label}</div>
                      <div className="flex-1 px-4 sm:px-5 py-2.5 text-sm text-text text-right">{row.value}</div>
                    </div>
                  );
                })}
                {c?.effect && (
                  <div className="px-4 sm:px-5 py-3 border-b border-[rgba(0,0,0,0.04)]">
                    <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Effect</div>
                    <div className="text-sm text-text leading-relaxed">{c.effect}</div>
                  </div>
                )}
                {!ext && (
                  <div className="px-4 py-4 space-y-3 animate-pulse">
                    <div className="h-4 w-24 bg-[#E4E4E7] rounded" />
                    <div className="h-4 w-full bg-[#E4E4E7] rounded" />
                  </div>
                )}
              </div>

              {/* Buy links */}
              <div className="px-4 sm:px-5 py-3 border-b border-[rgba(0,0,0,0.06)]">
                <div className="text-sm font-medium text-text mb-2">Buy this card</div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "TCGPlayer", url: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(card.cardName)}` },
                    { label: "Cardmarket", url: `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(card.cardName)}` },
                    { label: "eBay UK", url: `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${card.cardCode} ${card.cardName}`)}` },
                  ].map((link) => (
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.1)] text-text-muted hover:text-text hover:border-[rgba(0,0,0,0.2)] transition-colors">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Price chart + live price */}
              <div className="px-4 sm:px-5 py-3 space-y-3">
                <LivePriceBadge cardCode={card.cardCode} cardName={card.cardName} />
                <PriceChart cardCode={card.cardCode} />
              </div>

              {/* Grading ROI */}
              {sortedGrades.length > 0 && market > 0 && (
                <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
                  <GradingROI rawPrice={market} gradedPrices={gradedPrices} />
                </div>
              )}

              {/* Graded prices */}
              {sortedGrades.length > 0 && (
                <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
                  <div className="text-sm font-medium text-text-dim mb-2">Graded Prices</div>
                  {sortedGrades.map((g) => (
                    <div key={g} className="flex justify-between py-1.5 text-sm">
                      <span className="text-text-muted">{g}</span>
                      <span className="font-mono font-semibold text-[#059669]">{formatPrice(gradedPrices[g])}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {card.notes && (
                <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
                  <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Notes</div>
                  <p className="text-sm text-text">{card.notes}</p>
                </div>
              )}

              {/* Synergies */}
              {ext && ext.synergies.length > 0 && (
                <div className="border-t border-[rgba(0,0,0,0.06)] px-4 sm:px-5 py-3">
                  <div className="text-sm font-medium text-text-dim mb-2">Synergies</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {ext.synergies.map((s) => (
                      <div key={s.cid} className="flex-none w-[60px]">
                        <div className="aspect-[2.5/3.5] rounded overflow-hidden bg-[#E4E4E7] mb-1">
                          <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <div className="text-xs text-text-dim truncate">{s.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Edit form */
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1.5">Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={inputClass + " w-full"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1.5">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass + " w-full"}>
                    <option value="NM">NM</option><option value="LP">LP</option><option value="MP">MP</option><option value="HP">HP</option><option value="DMG">DMG</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer py-1">
                <input type="checkbox" checked={isGraded} onChange={(e) => setIsGraded(e.target.checked)} className="accent-accent" /> Graded
              </label>
              {isGraded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">Company</label>
                    <select value={gradedCompany} onChange={(e) => setGradedCompany(e.target.value)} className={inputClass + " w-full"}>
                      <option value="">—</option><option value="PSA">PSA</option><option value="BGS">BGS</option><option value="CGC">CGC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">Grade</label>
                    <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="10" className={inputClass + " w-full"} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-text-dim mb-1.5">Price paid</label>
                <input type="number" step="0.01" min="0" value={acquiredPrice} onChange={(e) => setAcquiredPrice(e.target.value)} placeholder="0.00" className={inputClass + " w-full"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-dim mb-1.5">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass + " w-full resize-none"} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-text text-bg font-medium text-sm py-2.5 px-4 rounded-xl active:opacity-80 disabled:opacity-40 transition-colors">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditing(false)} className="text-sm font-medium text-text-muted hover:text-text active:opacity-70 px-4 py-2.5 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
