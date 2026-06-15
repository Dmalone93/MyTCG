"use client";

import { useState, useEffect } from "react";
import type { CollectionCard, CardPrice } from "./collection-shell";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

const GRADE_ORDER = [
  "PSA 10", "PSA 9", "PSA 8",
  "BGS 10", "BGS 9.5",
  "CGC 10", "CGC 9.5",
  "Graded",
];

type ExtInfo = {
  card: {
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
  synergies: Array<{
    cid: string;
    name: string;
    color: string;
    rarity: string;
    imageUrl: string;
    traits: string;
  }>;
};

export function CardDetailModal({
  card,
  price,
  onClose,
  onUpdate,
  onDelete,
}: {
  card: CollectionCard;
  price: CardPrice | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CollectionCard>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(card.quantity ?? 1);
  const [condition, setCondition] = useState(card.condition ?? "NM");
  const [isGraded, setIsGraded] = useState(card.isGraded ?? false);
  const [grade, setGrade] = useState(card.grade ?? "");
  const [gradedCompany, setGradedCompany] = useState(card.gradedCompany ?? "");
  const [acquiredPrice, setAcquiredPrice] = useState(card.acquiredPrice ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<ExtInfo | null>(null);

  useEffect(() => {
    fetch(`/api/card-info?code=${encodeURIComponent(card.cardCode)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setExt(data); })
      .catch(() => {});
  }, [card.cardCode]);

  const market = num(price?.rawMarket);
  const paid = num(card.acquiredPrice);
  const pl = market > 0 ? (market - paid) * (card.quantity ?? 1) : null;
  const plColor = pl != null ? (pl >= 0 ? "#34D399" : "#F87171") : undefined;

  const gradedPrices = (price?.gradedPrices as Record<string, number> | null) ?? {};
  const sortedGrades = GRADE_ORDER.filter((g) => g in gradedPrices);

  async function handleSave() {
    setSaving(true);
    await onUpdate(card.id, {
      quantity,
      condition,
      isGraded: isGraded,
      grade: grade || null,
      gradedCompany: gradedCompany || null,
      acquiredPrice: acquiredPrice || null,
      notes: notes || null,
    });
    setSaving(false);
    setEditing(false);
  }

  const inputClass =
    "bg-bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-text focus:outline-2 focus:outline-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>
        <div className="sticky top-0 bg-bg-elevated border-b border-[rgba(255,255,255,0.04)] px-4 sm:px-5 py-3 sm:py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-text-dim">{card.cardCode}</span>
              {ext?.card.rarity && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">
                  {ext.card.rarity}
                </span>
              )}
              {ext?.card.color && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-text-dim">
                  {ext.card.color}
                </span>
              )}
            </div>
            <h2 className="font-semibold text-base sm:text-lg text-text leading-tight">{card.cardName}</h2>
            {ext?.card.setName && (
              <div className="text-xs text-text-dim mt-0.5">{ext.card.setName}</div>
            )}
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text active:opacity-70 text-xl leading-none mt-1 p-1 transition-colors flex-none">×</button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-5">
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.cardName} className="w-full max-w-[240px] mx-auto rounded-lg aspect-[2.5/3.5] object-cover" />
          )}

          {/* Extended card info */}
          {ext && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {ext.card.type && (
                <div className="bg-[rgba(255,255,255,0.02)] rounded-lg py-2 px-1">
                  <div className="text-[9px] font-mono uppercase text-text-dim mb-0.5">Type</div>
                  <div className="text-sm font-semibold text-text">{ext.card.type}</div>
                </div>
              )}
              {ext.card.cost != null && (
                <div className="bg-[rgba(255,255,255,0.02)] rounded-lg py-2 px-1">
                  <div className="text-[9px] font-mono uppercase text-text-dim mb-0.5">Cost</div>
                  <div className="text-sm font-semibold text-text">{ext.card.cost}</div>
                </div>
              )}
              {ext.card.power != null && (
                <div className="bg-[rgba(255,255,255,0.02)] rounded-lg py-2 px-1">
                  <div className="text-[9px] font-mono uppercase text-text-dim mb-0.5">Power</div>
                  <div className="text-sm font-semibold text-text">{ext.card.power}</div>
                </div>
              )}
              {ext.card.life != null && (
                <div className="bg-[rgba(255,255,255,0.02)] rounded-lg py-2 px-1">
                  <div className="text-[9px] font-mono uppercase text-text-dim mb-0.5">Life</div>
                  <div className="text-sm font-semibold text-text">{ext.card.life}</div>
                </div>
              )}
              {ext.card.counterPower != null && (
                <div className="bg-[rgba(255,255,255,0.02)] rounded-lg py-2 px-1">
                  <div className="text-[9px] font-mono uppercase text-text-dim mb-0.5">Counter</div>
                  <div className="text-sm font-semibold text-text">+{ext.card.counterPower}</div>
                </div>
              )}
            </div>
          )}

          {/* Traits */}
          {ext?.card.traits && (
            <div>
              <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1.5">Traits</div>
              <div className="text-sm text-text-muted">{ext.card.traits}</div>
            </div>
          )}

          {/* Effect */}
          {ext?.card.effect && (
            <div>
              <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-1.5">Effect</div>
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">{ext.card.effect}</p>
            </div>
          )}

          {ext?.card.altArt && (
            <div className="text-xs text-yellow-400 font-mono">Alt art by {ext.card.altArt}</div>
          )}

          {/* Prices */}
          <div className="bg-[rgba(255,255,255,0.02)] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">Market price</span>
              <span className="font-mono font-semibold text-lg">{market > 0 ? fmt(market) : "—"}</span>
            </div>
            {paid > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">Paid</span>
                <span className="font-mono font-semibold text-lg">{fmt(paid)}</span>
              </div>
            )}
            {pl != null && (
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim">P/L ({card.quantity ?? 1}x)</span>
                <span className="font-mono font-semibold text-lg" style={{ color: plColor }}>
                  {pl >= 0 ? "+" : ""}{fmt(pl)}
                </span>
              </div>
            )}
          </div>

          {sortedGrades.length > 0 && (
            <div>
              <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-2">Graded prices</div>
              <div className="bg-[rgba(255,255,255,0.02)] rounded-xl overflow-hidden">
                {sortedGrades.map((g) => (
                  <div key={g} className="flex justify-between items-center px-4 py-2.5 border-b border-[rgba(255,255,255,0.03)] last:border-0">
                    <span className="text-sm text-text-muted">{g}</span>
                    <span className="font-mono font-semibold text-sm text-[#34D399]">{fmt(gradedPrices[g])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synergies */}
          {ext && ext.synergies.length > 0 && (
            <div>
              <div className="font-mono text-[10px] tracking-[.1em] uppercase text-text-dim mb-2">Cards that synergize</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {ext.synergies.map((s) => (
                  <div key={s.cid} className="flex-none w-[80px]">
                    <div className="aspect-[2.5/3.5] rounded-md overflow-hidden bg-[#1C1C1F] mb-1">
                      <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="text-[10px] text-text-muted truncate">{s.name}</div>
                    <div className="text-[9px] font-mono text-text-dim">{s.cid}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!editing ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-dim">Quantity</span><span>{card.quantity ?? 1}</span></div>
              <div className="flex justify-between"><span className="text-text-dim">Condition</span><span>{card.condition ?? "—"}</span></div>
              {card.isGraded && (
                <div className="flex justify-between"><span className="text-text-dim">Grade</span><span>{card.gradedCompany} {card.grade}</span></div>
              )}
              {card.notes && (<div><span className="text-text-dim block mb-1">Notes</span><p className="text-text text-sm">{card.notes}</p></div>)}
              <div className="flex gap-2 pt-3">
                <button onClick={() => setEditing(true)} className="flex-1 bg-bg-surface border border-[rgba(255,255,255,0.06)] text-text font-semibold text-sm py-3 px-4 rounded-lg hover:bg-[#27272A] active:opacity-80 transition-colors">Edit</button>
                <button onClick={async () => { if (confirm(`Delete "${card.cardName}"?`)) { await onDelete(card.id); onClose(); } }} className="bg-bg-surface border border-[rgba(255,255,255,0.06)] text-red-400 font-semibold text-sm py-3 px-4 rounded-lg hover:bg-red-400/10 active:opacity-80 transition-colors">Delete</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={inputClass + " w-full"} />
                </div>
                <div>
                  <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass + " w-full"}>
                    <option value="NM">NM</option><option value="LP">LP</option><option value="MP">MP</option><option value="HP">HP</option><option value="DMG">DMG</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" checked={isGraded} onChange={(e) => setIsGraded(e.target.checked)} className="accent-accent" /> Graded
              </label>
              {isGraded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Company</label>
                    <select value={gradedCompany} onChange={(e) => setGradedCompany(e.target.value)} className={inputClass + " w-full"}>
                      <option value="">—</option><option value="PSA">PSA</option><option value="BGS">BGS</option><option value="CGC">CGC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Grade</label>
                    <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="10" className={inputClass + " w-full"} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Price paid</label>
                <input type="number" step="0.01" min="0" value={acquiredPrice} onChange={(e) => setAcquiredPrice(e.target.value)} placeholder="0.00" className={inputClass + " w-full"} />
              </div>
              <div>
                <label className="block text-[10px] font-mono tracking-[.1em] uppercase text-text-dim mb-1.5">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass + " w-full resize-none"} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex-1 border border-[rgba(255,255,255,0.12)] text-text font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-[rgba(255,255,255,0.05)] active:opacity-70 disabled:opacity-40 transition-colors">{saving ? "..." : "Save"}</button>
                <button onClick={() => setEditing(false)} className="text-sm text-text-muted hover:text-text active:opacity-70 px-4 py-3 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
