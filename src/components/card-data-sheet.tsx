"use client";

import { useEffect, useState } from "react";
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss";
import { useRegion } from "@/components/region-selector";
import { addCard as addCardAction } from "@/app/actions/collections";

type ExtCard = {
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

type ExtData = {
  card: ExtCard;
  synergies: Array<{ cid: string; name: string; imageUrl: string }>;
};

const COLOR_HEX: Record<string, string> = {
  Red: "#DC2626", Blue: "#2563EB", Green: "#16A34A",
  Purple: "#9333EA", Black: "#18181B", Yellow: "#CA8A04",
};

function colorDot(color: string) {
  // Handle multi-color like "Red/Blue" — show first color
  const first = color.split(/[\/\s]/)[0];
  const hex = COLOR_HEX[first];
  if (!hex) return null;
  return <span className="w-2.5 h-2.5 rounded-full flex-none inline-block" style={{ backgroundColor: hex }} />;
}

/** Render effect text with [bracketed values] as pills */
function renderEffect(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <span key={i} className="inline-flex items-center bg-[rgba(0,0,0,0.06)] text-text font-medium text-xs px-1.5 py-0.5 rounded mx-0.5 align-middle">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CardDataSheet({
  cardCode: initialCode,
  cardName: initialName,
  imageUrl: initialImage,
  marketPrice: initialPrice,
  rarity: initialRarity,
  cardColor: initialColor,
  cardType: initialType,
  cardCost: initialCost,
  cardPower: initialPower,
  cardText: initialCardText,
  subTypes: initialSubTypes,
  life: initialLife,
  counterAmount: initialCounter,
  setName: initialSet,
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
  cardText?: string;
  subTypes?: string;
  life?: string;
  counterAmount?: string;
  setName?: string;
  onClose: () => void;
}) {
  const swipe = useSwipeDismiss(onClose);
  const { formatPrice } = useRegion();

  // Current card (can change when tapping synergies)
  const [cardCode, setCardCode] = useState(initialCode);
  const [cardName, setCardName] = useState(initialName);
  const [imageUrl, setImageUrl] = useState(initialImage);
  const [marketPrice, setMarketPrice] = useState(initialPrice);
  const [catalogProps, setCatalogProps] = useState({
    rarity: initialRarity, color: initialColor, type: initialType,
    cost: initialCost, power: initialPower, setName: initialSet,
    cardText: initialCardText, subTypes: initialSubTypes,
    life: initialLife, counterAmount: initialCounter,
  });

  const [ext, setExt] = useState<ExtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  // Fetch card data whenever cardCode changes
  useEffect(() => {
    setExt(null);
    setLoading(true);

    fetch(`/api/card-info?code=${encodeURIComponent(cardCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setExt(data);
          // Update display from extended data
          if (data.card) {
            setCardName(data.card.name);
            setImageUrl(data.card.imageUrl || imageUrl);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardCode]);

  const c = ext?.card;

  // Display values with fallbacks
  const dType = c?.type ?? catalogProps.type ?? null;
  const dColor = c?.color ?? catalogProps.color ?? null;
  const dRarity = c?.rarity ?? catalogProps.rarity ?? null;
  const dCost = c?.cost ?? (catalogProps.cost ? Number(catalogProps.cost) : null);
  const dPower = c?.power ?? (catalogProps.power ? Number(catalogProps.power) : null);
  const dLife = c?.life ?? (catalogProps.life ? Number(catalogProps.life) : null);
  const dCounter = c?.counterPower ?? (catalogProps.counterAmount ? Number(catalogProps.counterAmount) : null);
  const dTraits = c?.traits ?? catalogProps.subTypes ?? null;
  const dSetName = c?.setName ?? catalogProps.setName ?? null;
  const dEffect = c?.effect ?? catalogProps.cardText ?? null;
  const dAltArt = c?.altArt ?? null;

  // Navigate to a synergy card
  function openSynergy(syn: { cid: string; name: string; imageUrl: string }) {
    setHistory((h) => [...h, cardCode]);
    setCardCode(syn.cid);
    setCardName(syn.name);
    setImageUrl(syn.imageUrl);
    setMarketPrice(null);
    setCatalogProps({ rarity: undefined, color: undefined, type: undefined, cost: undefined, power: undefined, setName: undefined, cardText: undefined, subTypes: undefined, life: undefined, counterAmount: undefined });
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCardCode(prev);
    // Data will load from the useEffect
  }

  // Data table rows
  const rows: Array<{ label: string; value: string | number | null }> = [
    { label: "Category", value: dType },
    { label: "Color", value: dColor },
    { label: "Rarity", value: dRarity },
    { label: "Cost", value: dCost },
    { label: "Power", value: dPower },
    { label: "Life", value: dLife },
    { label: "Counter", value: dCounter },
    { label: "Set", value: dSetName },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        ref={swipe.sheetRef}
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg min-h-[60vh] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div ref={swipe.handleRef} className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab flex-none" style={{ touchAction: "none" }}>
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex-none">
          {history.length > 0 && (
            <button onClick={goBack} className="text-sm text-text-muted hover:text-text active:opacity-70 mr-2 flex-none">←</button>
          )}
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="font-semibold text-base text-text truncate">{cardName}</h2>
            <div className="font-mono text-sm text-text-dim">{cardCode}</div>
          </div>
          {marketPrice != null && marketPrice > 0 && (
            <span className="font-mono text-sm font-semibold text-[#059669] flex-none">{formatPrice(marketPrice)}</span>
          )}
          <button onClick={onClose} className="text-text-dim hover:text-text text-xl p-1 active:opacity-70 transition-colors flex-none ml-2">×</button>
        </div>

        {/* Scrollable content — extra bottom padding for mobile nav */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-20 sm:pb-4">
          {/* Card image + stat pills */}
          <div className="flex gap-4 p-4">
            <img
              src={imageUrl}
              alt={cardName}
              className="w-[100px] sm:w-[120px] rounded-lg aspect-[63/88] object-contain flex-none"
            />
            <div className="flex-1 min-w-0 space-y-2">
              {/* Pills */}
              <div className="flex flex-wrap gap-1.5">
                {dType && <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{dType}</span>}
                {dColor && <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg inline-flex items-center gap-1.5">{colorDot(dColor)}{dColor}</span>}
                {dRarity && <span className="text-xs font-medium bg-bg-surface px-2 py-1 rounded-lg">{dRarity}</span>}
              </div>

              {/* Traits */}
              {dTraits && <div className="text-sm text-text-dim">{dTraits}</div>}

              {/* Set */}
              {dSetName && <div className="text-xs text-text-dim">{dSetName}</div>}

              {/* Alt art */}
              {dAltArt && <div className="text-xs text-text-dim">Art: {dAltArt}</div>}

              {loading && !c && (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-3 w-20 bg-[#E4E4E7] rounded" />
                  <div className="h-3 w-32 bg-[#E4E4E7] rounded" />
                </div>
              )}
            </div>
          </div>

          {/* Data table */}
          <div className="border-t border-[rgba(0,0,0,0.06)]">
            {rows.map((row) => {
              if (row.value == null) return null;
              const isColor = row.label === "Color";
              return (
                <div key={row.label} className="flex border-b border-[rgba(0,0,0,0.04)]">
                  <div className="w-[80px] sm:w-[100px] flex-none px-4 py-2 text-sm text-text-dim">{row.label}</div>
                  <div className="flex-1 px-4 py-2 text-sm text-text text-right font-mono flex items-center justify-end gap-1.5">
                    {isColor && colorDot(String(row.value))}
                    {row.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Effect text */}
          {dEffect && (
            <div className="px-4 py-4">
              <div className="text-xs text-text-dim uppercase tracking-wider mb-1.5">Effect</div>
              <div className="text-sm text-text leading-relaxed bg-bg-surface rounded-xl p-3 whitespace-pre-line">
                {renderEffect(dEffect)}
              </div>
            </div>
          )}

          {/* Add to collection */}
          <AddToCollectionButton cardCode={cardCode} cardName={cardName} imageUrl={imageUrl} marketPrice={marketPrice} />

          {/* Buy links */}
          <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-4">
            <div className="text-xs text-text-dim uppercase tracking-wider mb-3">Buy this card</div>
            <div className="flex gap-2">
              <a href={`https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(`${cardCode} ${cardName}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors">
                <img src="/logos/ebay.svg" alt="eBay" className="h-[20px]" />
              </a>
              <a href={`https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(cardCode)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors">
                <img src="/logos/cardmarket.png" alt="Cardmarket" className="h-[24px]" />
              </a>
              <a href={`https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(cardCode)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-bg-surface active:opacity-70 transition-colors">
                <img src="/logos/tcgplayer.svg" alt="TCGplayer" className="h-[20px]" />
              </a>
            </div>
          </div>

          {/* Synergies — tappable */}
          {ext && ext.synergies.length > 0 && (
            <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-4">
              <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Synergies</div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {ext.synergies.map((s) => (
                  <button
                    key={s.cid}
                    onClick={() => openSynergy(s)}
                    className="flex-none w-[60px] text-left active:opacity-70 transition-opacity"
                  >
                    <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-[#E4E4E7] mb-1">
                      <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="text-xs text-text-dim truncate">{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline add-to-collection button that fetches collections on demand */
function AddToCollectionButton({ cardCode, cardName, imageUrl, marketPrice }: {
  cardCode: string; cardName: string; imageUrl: string; marketPrice?: number | null;
}) {
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  async function loadCollections() {
    if (collections.length > 0) { setShowPicker(true); return; }
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
        setShowPicker(true);
      }
    } catch { /* */ }
  }

  async function addToCollection(collectionId: string) {
    setAdding(true);
    try {
      await addCardAction({
        collectionId,
        cardCode,
        cardName,
        quantity: 1,
        condition: "NM",
        isGraded: false,
        grade: null,
        gradedCompany: null,
        acquiredPrice: null,
        notes: null,
        imageUrl,
        marketPrice: marketPrice ?? null,
      });
      const col = collections.find((c) => c.id === collectionId);
      setAdded(col?.name ?? "collection");
      setShowPicker(false);
      setTimeout(() => setAdded(null), 2000);
    } catch { /* */ }
    setAdding(false);
  }

  return (
    <div className="border-t border-[rgba(0,0,0,0.06)] px-4 py-4">
      {added ? (
        <div className="text-sm font-medium text-[#059669] text-center py-2">
          Added to {added}
        </div>
      ) : !showPicker ? (
        <button
          onClick={loadCollections}
          className="w-full bg-text text-bg font-medium text-sm py-2.5 rounded-xl active:opacity-80 transition-colors"
        >
          + Add to collection
        </button>
      ) : (
        <div>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Choose collection</div>
          <div className="space-y-1.5">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => addToCollection(col.id)}
                disabled={adding}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-text bg-bg-surface rounded-xl hover:bg-[rgba(0,0,0,0.04)] active:opacity-70 disabled:opacity-40 transition-colors"
              >
                {col.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowPicker(false)}
            className="w-full text-sm text-text-muted mt-2 py-1 active:opacity-70"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
