"use client";

import { useState, useEffect } from "react";
import { useRegion } from "@/components/region-selector";

type CatalogCard = {
  id: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardType: string | null;
  color: string | null;
  rarity: string | null;
  cost: number | null;
  power: number | null;
  imageUrl: string | null;
};

type MissingAlert = {
  id: string;
  cardCode: string;
  cardName: string | null;
  detectedIn: string;
  detectedPrice: string | null;
  createdAt: string;
};

type Variant = {
  id: string;
  baseCardId: string;
  variantType: string;
  variantName: string | null;
  imageUrl: string | null;
  marketPrice: string | null;
  source: string | null;
};

export default function AdminPage() {
  const { formatPrice } = useRegion();
  const [tab, setTab] = useState<"catalog" | "missing" | "add" | "sync">("catalog");
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [missing, setMissing] = useState<MissingAlert[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Add card form
  const [addForm, setAddForm] = useState({
    id: "", name: "", setId: "", setName: "", cardType: "", color: "",
    rarity: "", cost: "", power: "", life: "", counterPower: "",
    traits: "", effect: "", imageUrl: "", variantType: "", variantName: "",
    baseCardId: "",
  });
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Search catalog
  async function searchCatalog() {
    setLoading(true);
    const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(searchQ)}&limit=50`);
    if (res.ok) setCards(await res.json());
    setLoading(false);
  }

  // Load missing alerts
  async function loadMissing() {
    const res = await fetch("/api/admin/missing");
    if (res.ok) setMissing(await res.json());
  }

  // Resolve missing alert
  async function resolveAlert(id: string) {
    await fetch("/api/admin/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMissing((prev) => prev.filter((a) => a.id !== id));
  }

  // Load variants for a card
  async function loadVariants(cardId: string) {
    setSelectedCard(cardId);
    const res = await fetch(`/api/admin/variants?cardId=${encodeURIComponent(cardId)}`);
    if (res.ok) setVariants(await res.json());
  }

  // Add card
  async function handleAdd() {
    const res = await fetch("/api/admin/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    if (res.ok) {
      setAddMsg("Card added successfully");
      setAddForm({ id: "", name: "", setId: "", setName: "", cardType: "", color: "", rarity: "", cost: "", power: "", life: "", counterPower: "", traits: "", effect: "", imageUrl: "", variantType: "", variantName: "", baseCardId: "" });
      setTimeout(() => setAddMsg(null), 2000);
    } else {
      const err = await res.json();
      setAddMsg(`Error: ${err.error}`);
    }
  }

  // Run sync
  async function runSync() {
    setSyncResult("Running...");
    try {
      const res = await fetch("/api/pipeline/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(`Done: ${data.stats?.upserted ?? 0} cards upserted, ${data.stats?.errors?.length ?? 0} errors`);
    } catch {
      setSyncResult("Failed — check logs");
    }
  }

  // Run price refresh
  async function runPriceRefresh() {
    setSyncResult("Refreshing prices...");
    try {
      const res = await fetch("/api/refresh-prices", { method: "POST" });
      const data = await res.json();
      setSyncResult(`Prices refreshed: ${data.updated ?? 0} updated, ${data.deals ?? 0} deals found`);
    } catch {
      setSyncResult("Failed — check logs");
    }
  }

  useEffect(() => {
    if (tab === "missing") loadMissing();
  }, [tab]);

  const inputClass = "bg-bg-surface border border-[rgba(0,0,0,0.06)] rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-text/20 w-full";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-text mb-4">Admin</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(0,0,0,0.06)]">
        {(["catalog", "missing", "add", "sync"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium transition-colors relative ${
              tab === t ? "text-text" : "text-text-dim hover:text-text"
            }`}
          >
            {t === "catalog" ? "Catalog" : t === "missing" ? "Missing" : t === "add" ? "Add Card" : "Sync"}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
          </button>
        ))}
      </div>

      {/* ═══ CATALOG TAB ═══ */}
      {tab === "catalog" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCatalog()}
              placeholder="Search by code or name..."
              className={inputClass + " flex-1"}
            />
            <button onClick={searchCatalog} className="bg-text text-bg font-medium text-sm py-2 px-4 rounded-lg active:opacity-80">
              Search
            </button>
          </div>
          {loading && <div className="text-sm text-text-dim animate-pulse">Loading...</div>}
          <div className="space-y-1">
            {cards.map((card) => (
              <div key={card.id} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl px-3 py-2.5">
                {card.imageUrl && (
                  <div className="w-8 aspect-[63/88] rounded overflow-hidden bg-[#E4E4E7] flex-none">
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{card.name}</div>
                  <div className="text-xs text-text-dim font-mono">{card.id} · {card.rarity} · {card.color}</div>
                </div>
                <button
                  onClick={() => loadVariants(card.id)}
                  className="text-xs text-text-dim hover:text-text active:opacity-70"
                >
                  Variants
                </button>
              </div>
            ))}
          </div>

          {/* Variants panel */}
          {selectedCard && (
            <div className="mt-4 bg-bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text">Variants for {selectedCard}</span>
                <button onClick={() => setSelectedCard(null)} className="text-xs text-text-dim">Close</button>
              </div>
              {variants.length === 0 ? (
                <div className="text-sm text-text-dim">No variants recorded</div>
              ) : (
                <div className="space-y-1">
                  {variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-2">
                      <span className="font-mono text-text-dim text-xs">{v.variantType}</span>
                      {v.variantName && <span className="text-text">{v.variantName}</span>}
                      {v.marketPrice && <span className="font-mono text-[#059669] ml-auto">{formatPrice(Number(v.marketPrice))}</span>}
                      <span className="text-xs text-text-dim">{v.source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ MISSING TAB ═══ */}
      {tab === "missing" && (
        <div>
          <p className="text-sm text-text-dim mb-4">Cards found in pricing data that aren't in our catalog.</p>
          {missing.length === 0 ? (
            <div className="text-sm text-text-dim py-8 text-center">No missing card alerts</div>
          ) : (
            <div className="space-y-1">
              {missing.map((alert) => (
                <div key={alert.id} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text font-mono">{alert.cardCode}</div>
                    <div className="text-xs text-text-dim">
                      {alert.cardName ?? "Unknown"} · via {alert.detectedIn}
                      {alert.detectedPrice && ` · ${formatPrice(Number(alert.detectedPrice))}`}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAddForm((prev) => ({ ...prev, id: alert.cardCode, name: alert.cardName ?? "" }));
                      setTab("add");
                    }}
                    className="text-xs font-medium text-text-muted hover:text-text active:opacity-70"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs text-text-dim hover:text-text active:opacity-70"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD CARD TAB ═══ */}
      {tab === "add" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Card Code *</label>
              <input value={addForm.id} onChange={(e) => setAddForm((p) => ({ ...p, id: e.target.value }))} placeholder="OP01-047" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Name *</label>
              <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Monkey D. Luffy" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Set ID</label>
              <input value={addForm.setId} onChange={(e) => setAddForm((p) => ({ ...p, setId: e.target.value }))} placeholder="OP-01" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Set Name</label>
              <input value={addForm.setName} onChange={(e) => setAddForm((p) => ({ ...p, setName: e.target.value }))} placeholder="Romance Dawn" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Type</label>
              <select value={addForm.cardType} onChange={(e) => setAddForm((p) => ({ ...p, cardType: e.target.value }))} className={inputClass}>
                <option value="">—</option>
                <option value="Leader">Leader</option>
                <option value="Character">Character</option>
                <option value="Event">Event</option>
                <option value="Stage">Stage</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Color</label>
              <input value={addForm.color} onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))} placeholder="Red" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Rarity</label>
              <input value={addForm.rarity} onChange={(e) => setAddForm((p) => ({ ...p, rarity: e.target.value }))} placeholder="SR" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Cost</label>
              <input type="number" value={addForm.cost} onChange={(e) => setAddForm((p) => ({ ...p, cost: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Power</label>
              <input type="number" value={addForm.power} onChange={(e) => setAddForm((p) => ({ ...p, power: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1">Image URL</label>
              <input value={addForm.imageUrl} onChange={(e) => setAddForm((p) => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">Traits</label>
            <input value={addForm.traits} onChange={(e) => setAddForm((p) => ({ ...p, traits: e.target.value }))} placeholder="Straw Hat Crew / Supernovas" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-dim mb-1">Effect</label>
            <textarea value={addForm.effect} onChange={(e) => setAddForm((p) => ({ ...p, effect: e.target.value }))} rows={3} className={inputClass + " resize-none"} />
          </div>

          {/* Variant section */}
          <div className="border-t border-[rgba(0,0,0,0.06)] pt-3 mt-3">
            <div className="text-xs font-medium text-text-dim mb-2">Variant (optional — link to existing base card)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-dim mb-1">Base Card ID</label>
                <input value={addForm.baseCardId} onChange={(e) => setAddForm((p) => ({ ...p, baseCardId: e.target.value }))} placeholder="OP01-047" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Variant Type</label>
                <select value={addForm.variantType} onChange={(e) => setAddForm((p) => ({ ...p, variantType: e.target.value }))} className={inputClass}>
                  <option value="">—</option>
                  <option value="alt-art">Alt Art</option>
                  <option value="promo-stamped">Promo Stamped</option>
                  <option value="pre-release">Pre-release</option>
                  <option value="winner">Winner</option>
                  <option value="manga-art">Manga Art</option>
                  <option value="parallel">Parallel</option>
                  <option value="foil">Foil</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-dim mb-1">Variant Name</label>
                <input value={addForm.variantName} onChange={(e) => setAddForm((p) => ({ ...p, variantName: e.target.value }))} placeholder="Tournament Pack" className={inputClass} />
              </div>
            </div>
          </div>

          <button onClick={handleAdd} className="bg-text text-bg font-medium text-sm py-2.5 px-6 rounded-xl active:opacity-80 transition-colors">
            Add Card
          </button>
          {addMsg && <div className="text-sm text-[#059669]">{addMsg}</div>}
        </div>
      )}

      {/* ═══ SYNC TAB ═══ */}
      {tab === "sync" && (
        <div className="space-y-4">
          <p className="text-sm text-text-dim">Run the data pipeline to sync from external sources.</p>
          <div className="flex gap-3">
            <button onClick={runSync} className="bg-text text-bg font-medium text-sm py-2.5 px-5 rounded-xl active:opacity-80 transition-colors">
              Sync Catalog
            </button>
            <button onClick={runPriceRefresh} className="border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-2.5 px-5 rounded-xl active:opacity-70 transition-colors">
              Refresh Prices
            </button>
          </div>
          {syncResult && (
            <div className="bg-bg-surface rounded-xl p-3 text-sm text-text font-mono">{syncResult}</div>
          )}
        </div>
      )}
    </div>
  );
}
