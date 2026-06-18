"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { useSwipeDismiss } from "@/hooks/use-swipe-dismiss";
import { ScanResultScreen } from "./scan-result-screen";
import { CardPicker } from "./card-picker";
import { useRegion } from "./region-selector";
import { addCard as addCardAction } from "@/app/actions/collections";

type ScanResult = {
  codes: string[];
  text: string;
  bestGuess: string | null;
  labels: string[];
  cardName: string | null;
  rarity: string | null;
  color: string | null;
  variantCounts?: Record<string, number>;
  matchingImageUrls?: string[];
};

type CardIndex = Array<{ id: string; n: string; r: string; c: string; img: string; alt?: string }>;
type ScanMode = "choose" | "price-check" | "add-single" | "add-batch";
type BatchCard = { card: CatalogCard; addedAt: number };

function extractCodesLocal(text: string): string[] {
  const codes: string[] = [];
  const up = text.toUpperCase().replace(/E[86]\s*(\d)/g, "EB$1").replace(/PR[86]/g, "PRB");
  const re = /(OP|ST|EB|PRB)\s*[O0]?(\d{1,2})\s*[-\s.]\s*(\d{2,3})/g;
  let m;
  while ((m = re.exec(up)) !== null) {
    codes.push(m[1] + m[2].padStart(2, "0") + "-" + m[3].padStart(3, "0"));
  }
  const pre = /P\s*[-\s.]\s*(\d{3})/g;
  while ((m = pre.exec(up)) !== null) codes.push("P-" + m[1]);
  return [...new Set(codes)];
}

function matchLocalIndex(text: string, index: CardIndex): CardIndex {
  if (!text || text.length < 3) return [];
  const textUp = text.toUpperCase();
  const codes = extractCodesLocal(text);
  if (codes.length > 0) {
    const matches = index.filter((c) => codes.some((code) => c.id.toUpperCase() === code));
    if (matches.length > 0) return matches;
  }
  const scored = index
    .map((card) => {
      let score = 0;
      const nameUp = card.n.toUpperCase();
      const words = nameUp.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) { if (textUp.includes(word)) score += word.length; }
      if (textUp.includes(nameUp)) score += 100;
      return { card, score };
    })
    .filter((s) => s.score > 8)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.card);
}

export function ScanModal({
  onResult,
  onClose,
  quickMode = false,
}: {
  onResult: (card: CatalogCard) => void;
  onClose: () => void;
  quickMode?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanGenRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingScanRef = useRef(false);
  const cardIndexRef = useRef<CardIndex>([]);
  const visionCallCount = useRef(0);

  const [mode, setMode] = useState<ScanMode>("choose");
  const [status, setStatus] = useState("Starting camera...");
  const [confidence, setConfidence] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedCards, setMatchedCards] = useState<CatalogCard[]>([]);
  const [resultCard, setResultCard] = useState<CatalogCard | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const wasRescannedRef = useRef(false);
  const { formatPrice } = useRegion();
  const swipe = useSwipeDismiss(onClose);

  // Card preview
  const [previewCard, setPreviewCard] = useState<CatalogCard | null>(null);

  // Batch mode state
  const [batchCards, setBatchCards] = useState<BatchCard[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Load card index
  useEffect(() => {
    fetch("/api/card-index")
      .then((r) => r.json())
      .then((data: CardIndex) => { cardIndexRef.current = data; })
      .catch(() => {});
  }, []);

  // Load collections for add modes
  useEffect(() => {
    if (mode === "add-single" || mode === "add-batch") {
      fetch("/api/collections")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          setCollections(data);
          if (data.length > 0 && !selectedCollection) setSelectedCollection(data[0].id);
        })
        .catch(() => {});
    }
  }, [mode]);

  // Start camera
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not available");
      return;
    }
    const isMobile = window.innerWidth < 640;
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    }).then((stream) => {
      streamRef.current = stream;
      attachStream();
      setCameraReady(true);
      setStatus("Point camera at a card");
    }).catch(() => { setStatus("Camera access denied"); });

    return () => {
      stopScanning();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Re-attach stream when video element changes (mode switch)
  function attachStream() {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }

  useEffect(() => { attachStream(); }, [mode]);

  function startScanning() {
    stopScanning();
    scanGenRef.current++;
    setScanning(true);
    pendingScanRef.current = false;
    visionCallCount.current = 0;
    setConfidence(0);
    setMatchedCards([]);
    scanFrame();
    scanTimerRef.current = setInterval(scanFrame, 800);
  }

  function stopScanning() {
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
    setScanning(false);
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    const w = Math.min(480, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
  }

  const scanFrame = useCallback(async () => {
    if (pendingScanRef.current) return;
    pendingScanRef.current = true;
    const gen = scanGenRef.current;
    try {
      visionCallCount.current++;
      const base64 = captureFrame();
      if (!base64) { pendingScanRef.current = false; return; }

      // First 2 frames are fast (text-only) for quick feedback, then every 4th is full
      const useFullDetection = visionCallCount.current > 2 && visionCallCount.current % 4 === 0;
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, fast: !useFullDetection }),
      });
      if (gen !== scanGenRef.current) { pendingScanRef.current = false; return; }
      const data: ScanResult = await res.json();

      const allText = [data.text, data.bestGuess, data.cardName, ...(data.labels ?? [])].filter(Boolean).join(" ");
      const localMatches = matchLocalIndex(allText, cardIndexRef.current);

      if (data.codes && data.codes.length > 0) {
        const code = data.codes[0];
        stopScanning();
        setConfidence(100);
        setStatus(`Found: ${code}`);
        await lookupCard(code);
      } else if (localMatches.length > 0) {
        stopScanning();
        setConfidence(90);
        setStatus(`Matched: ${localMatches[0].n}`);
        await lookupCards(localMatches.map((m) => m.id));
      } else if (allText.length > 10) {
        setConfidence(Math.min(50, visionCallCount.current * 10));
        setStatus("Reading... hold steady");
      } else {
        setConfidence(Math.min(20, visionCallCount.current * 5));
        setStatus("Scanning...");
      }
    } catch { /* */ }
    pendingScanRef.current = false;
  }, []);

  async function lookupCard(code: string) {
    const codeUp = code.toUpperCase();
    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(code)}`);
      const cards: CatalogCard[] = await res.json();

      // STRICT: only show exact code matches (including alt arts with same code)
      const exact = cards.filter((c) => c.cardSetId.toUpperCase() === codeUp);
      if (exact.length > 0) {
        setMatchedCards(exact);
        return;
      }

      // Fallback: check if any card starts with the same set prefix + number
      // e.g. OP06-007 should NOT match OP16-006
      const samePrefix = cards.filter((c) => {
        const cid = c.cardSetId.toUpperCase();
        // Must match the full set+number prefix (e.g. OP06-007 matches OP06-007*)
        return cid.startsWith(codeUp.split("-")[0] + "-");
      });
      if (samePrefix.length > 0) {
        setMatchedCards(samePrefix.slice(0, 5));
        return;
      }
    } catch { /* */ }

    // Local index fallback — strict match only
    const local = cardIndexRef.current.filter((c) => c.id.toUpperCase() === codeUp);
    if (local.length > 0) {
      setMatchedCards(local.map((c) => ({
        cardSetId: c.id, cardName: c.n, setName: "", setId: "", rarity: c.r, cardColor: c.c,
        cardType: "", cardCost: "", cardPower: "", cardText: "", subTypes: "", life: "", counterAmount: "",
        imageUrl: c.img, marketPrice: null, inventoryPrice: null,
      })));
    } else {
      setStatus(`Code ${code} not found`);
    }
  }

  async function lookupCards(codes: string[]) {
    const codesUp = new Set(codes.map((c) => c.toUpperCase()));
    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(codes[0])}`);
      const cards: CatalogCard[] = await res.json();
      // Strict: only exact code matches
      const exact = cards.filter((c) => codesUp.has(c.cardSetId.toUpperCase()));
      if (exact.length > 0) { setMatchedCards(exact.slice(0, 5)); return; }
    } catch { /* */ }
    const local = codes.flatMap((code) => cardIndexRef.current.filter((c) => c.id.toUpperCase() === code.toUpperCase()));
    if (local.length > 0) {
      setMatchedCards(local.slice(0, 5).map((c) => ({
        cardSetId: c.id, cardName: c.n, setName: "", setId: "", rarity: c.r, cardColor: c.c,
        cardType: "", cardCost: "", cardPower: "", cardText: "", subTypes: "", life: "", counterAmount: "",
        imageUrl: c.img, marketPrice: null, inventoryPrice: null,
      })));
    }
  }

  function resetScan() {
    setResultCard(null);
    setMatchedCards([]);
    setConfidence(0);
    visionCallCount.current = 0;
    wasRescannedRef.current = true;
    // Re-attach stream after state update renders new video element
    setTimeout(() => {
      attachStream();
      startScanning();
    }, 50);
  }

  // Add card to collection (single or batch)
  async function addToCollection(card: CatalogCard) {
    if (!selectedCollection) return;
    await addCardAction({
      collectionId: selectedCollection,
      cardCode: card.cardSetId,
      cardName: card.cardName,
      quantity: 1,
      condition: "NM",
      isGraded: false,
      grade: null,
      gradedCompany: null,
      acquiredPrice: null,
      notes: null,
      imageUrl: card.imageUrl ?? null,
      marketPrice: card.marketPrice ?? null,
    });
  }

  const confidenceColor = confidence >= 80 ? "#059669" : confidence >= 40 ? "#FACC15" : "rgba(0,0,0,0.15)";
  const batchTotal = batchCards.reduce((s, b) => s + (b.card.marketPrice ?? 0), 0);
  const selectedColName = collections.find((c) => c.id === selectedCollection)?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        ref={swipe.sheetRef}
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ overscrollBehavior: "none" }}
      >
        <div ref={swipe.handleRef} className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab" style={{ touchAction: "none" }}>
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(0,0,0,0.04)] flex-none">
          {mode !== "choose" && (
            <button onClick={() => { setMode("choose"); setMatchedCards([]); setResultCard(null); stopScanning(); }} className="text-sm text-text-muted hover:text-text active:opacity-70 flex-none">
              ←
            </button>
          )}
          <h2 className="font-semibold text-sm text-text flex-1">
            {mode === "choose" ? "Scan Card" : mode === "price-check" ? "Price Check" : mode === "add-batch" ? `Batch Add · ${batchCards.length} cards` : "Add to Collection"}
          </h2>
          <button onClick={onClose} className="text-text-dim hover:text-text active:opacity-70 text-lg p-1 transition-colors flex-none">×</button>
        </div>

        {/* Hidden video — always in DOM so camera can attach */}
        {mode === "choose" && (
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        )}

        {/* ═══ MODE CHOOSER ═══ */}
        {mode === "choose" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
            <div className="text-text-dim text-sm mb-2">What do you want to do?</div>
            <button
              onClick={() => { setMode("price-check"); if (cameraReady) startScanning(); }}
              className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-4 text-left hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
            >
              <div className="text-base font-semibold text-text">Price Check</div>
              <div className="text-sm text-text-dim mt-0.5">Scan a card to see market price and listings</div>
            </button>
            <button
              onClick={() => { setMode("add-single"); if (cameraReady) startScanning(); }}
              className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-4 text-left hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
            >
              <div className="text-base font-semibold text-text">Add Single Card</div>
              <div className="text-sm text-text-dim mt-0.5">Scan and add one card to your collection</div>
            </button>
            <button
              onClick={() => { setMode("add-batch"); if (cameraReady) startScanning(); }}
              className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-4 text-left hover:bg-[rgba(0,0,0,0.02)] active:opacity-80 transition-colors"
            >
              <div className="text-base font-semibold text-text">Batch Scan</div>
              <div className="text-sm text-text-dim mt-0.5">Scan multiple cards quickly — running total</div>
            </button>
          </div>
        )}

        {/* ═══ CAMERA ═══ */}
        {mode !== "choose" && !resultCard && (
          <div className="relative bg-white overflow-hidden flex-none h-[55vh] sm:h-[45vh]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {scanning && matchedCards.length === 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-accent/30 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent rounded-br-lg" />
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[rgba(0,0,0,0.3)]">
              <div className="h-full transition-all duration-300 ease-out rounded-r-full" style={{ width: `${confidence}%`, backgroundColor: confidenceColor }} />
            </div>
          </div>
        )}

        {/* Status + scanning indicator */}
        {mode !== "choose" && !resultCard && matchedCards.length === 0 && (
          <div className="flex-none">
            {/* Animated scanning bar */}
            {scanning && (
              <div className="h-1 bg-[rgba(0,0,0,0.06)] overflow-hidden">
                <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: `${Math.max(confidence, 15)}%`, transition: "width 0.3s ease-out" }} />
              </div>
            )}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-text-muted">{status}</span>
              {scanning && <span className="text-xs text-text-dim animate-pulse">Scanning...</span>}
            </div>
          </div>
        )}

        {/* ═══ VARIANT SELECTION ═══ */}
        {!resultCard && matchedCards.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2 text-xs font-medium text-text-dim uppercase tracking-wider">
              {matchedCards.length === 1 ? "Is this your card?" : `${matchedCards.length} variants found — pick yours`}
            </div>
            {matchedCards.map((card, i) => (
              <div key={card.cardSetId + card.cardName + i} className="px-4 py-3 border-b border-[rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPreviewCard(card)} className="flex-none active:scale-95 transition-transform">
                    <img src={card.imageUrl} alt="" className="w-14 aspect-[63/88] rounded-lg object-contain" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{card.cardName}</div>
                    <div className="text-xs text-text-dim">{card.cardSetId} · {card.rarity}</div>
                    {card.marketPrice != null && card.marketPrice > 0 && (
                      <div className="font-mono text-sm font-semibold text-[#059669] mt-0.5">{formatPrice(card.marketPrice)}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      if (mode === "price-check") setResultCard(card);
                      else if (mode === "add-single") { setShowCollectionPicker(true); setResultCard(card); }
                      else if (mode === "add-batch") {
                        // Stage card locally — NOT added to DB yet
                        setBatchCards((prev) => [...prev, { card, addedAt: Date.now() }]);
                        setMatchedCards([]); setConfidence(0); visionCallCount.current = 0;
                        setStatus(`Staged ${batchCards.length + 1} cards`);
                        setTimeout(() => { attachStream(); startScanning(); }, 300);
                      }
                    }}
                    className={`flex-1 text-sm font-medium py-2 rounded-xl active:opacity-80 transition-colors ${
                      mode === "add-batch" ? "bg-[#059669] text-white" : "bg-text text-bg"
                    }`}
                  >
                    {mode === "price-check" ? "Check price" : mode === "add-batch" ? "+ Add" : "Select"}
                  </button>
                  <button onClick={resetScan} className="bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text-dim font-medium text-sm py-2 px-4 rounded-xl active:opacity-70 transition-colors">
                    Rescan
                  </button>
                </div>
              </div>
            ))}
            {/* Wrong card entirely */}
            <div className="px-4 py-3 flex items-center justify-center">
              <button onClick={() => { setMatchedCards([]); setShowManualEntry(true); }} className="text-sm font-medium text-text-muted hover:text-text active:opacity-70">
                Wrong card? Enter code manually
              </button>
            </div>
          </div>
        )}

        {/* ═══ COLLECTION PICKER (add-single) ═══ */}
        {mode === "add-single" && resultCard && showCollectionPicker && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex gap-3 items-start mb-4">
              <img src={resultCard.imageUrl} alt="" className="w-14 aspect-[63/88] rounded-lg object-contain flex-none" />
              <div>
                <div className="text-sm font-semibold text-text">{resultCard.cardName}</div>
                <div className="text-xs text-text-dim">{resultCard.cardSetId}</div>
              </div>
            </div>
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Add to collection</div>
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={async () => {
                  setSelectedCollection(col.id);
                  await addCardAction({
                    collectionId: col.id,
                    cardCode: resultCard.cardSetId,
                    cardName: resultCard.cardName,
                    quantity: 1, condition: "NM", isGraded: false, grade: null, gradedCompany: null,
                    acquiredPrice: null, notes: null,
                    imageUrl: resultCard.imageUrl ?? null, marketPrice: resultCard.marketPrice ?? null,
                  });
                  setStatus(`Added to ${col.name}!`);
                  setShowCollectionPicker(false);
                  setResultCard(null);
                  setMatchedCards([]);
                  setTimeout(() => { setMode("choose"); }, 1500);
                }}
                className="w-full text-left px-3 py-3 text-sm font-medium text-text bg-white border border-[rgba(0,0,0,0.06)] rounded-xl mb-1.5 hover:bg-bg-surface active:opacity-70 transition-colors"
              >
                {col.name}
              </button>
            ))}
          </div>
        )}

        {/* ═══ PRICE CHECK RESULT ═══ */}
        {mode === "price-check" && resultCard && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ScanResultScreen
                card={resultCard}
                onRescan={resetScan}
                onManualEntry={() => setShowManualEntry(true)}
                onClose={onClose}
              />
            </div>
            <div className="flex-none flex gap-2 px-4 py-3 border-t border-[rgba(0,0,0,0.06)] bg-bg-elevated">
              <button onClick={resetScan} className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70">
                Scan another
              </button>
            </div>
          </>
        )}

        {/* ═══ BATCH SUMMARY BAR ═══ */}
        {mode === "add-batch" && batchCards.length > 0 && !resultCard && matchedCards.length === 0 && !showCollectionPicker && (
          <div className="flex-none px-4 py-2.5 border-t border-[rgba(0,0,0,0.06)] bg-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-1.5 flex-none">
                {batchCards.slice(-3).reverse().map((b) => (
                  <img key={b.addedAt} src={b.card.imageUrl} alt="" className="w-6 aspect-[63/88] rounded object-cover border-2 border-white" />
                ))}
              </div>
              <span className="text-sm font-semibold text-text">{batchCards.length}</span>
              <span className="font-mono text-sm text-[#059669]">{formatPrice(batchTotal)}</span>
              <div className="flex-1" />
              <button onClick={() => setBatchCards([])} className="text-xs text-text-dim active:opacity-70">Clear</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCollectionPicker(true)}
                className="flex-1 bg-text text-bg font-medium text-sm py-2 rounded-xl active:opacity-80 transition-colors"
              >
                Add {batchCards.length} to collection
              </button>
              <button onClick={() => setShowManualEntry(true)} className="border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-2 px-3 rounded-xl active:opacity-70">
                Enter code
              </button>
            </div>
          </div>
        )}

        {/* ═══ BATCH COLLECTION PICKER — confirm + add all ═══ */}
        {mode === "add-batch" && showCollectionPicker && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="text-sm font-semibold text-text mb-1">Add {batchCards.length} card{batchCards.length !== 1 ? "s" : ""} to:</div>
            <div className="text-xs text-text-dim mb-3">Total value: {formatPrice(batchTotal)}</div>
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={async () => {
                  // Add ALL staged cards to this collection
                  setStatus("Adding cards...");
                  for (const b of batchCards) {
                    await addCardAction({
                      collectionId: col.id,
                      cardCode: b.card.cardSetId,
                      cardName: b.card.cardName,
                      quantity: 1, condition: "NM", isGraded: false, grade: null, gradedCompany: null,
                      acquiredPrice: null, notes: null,
                      imageUrl: b.card.imageUrl ?? null, marketPrice: b.card.marketPrice ?? null,
                    });
                  }
                  setStatus(`Added ${batchCards.length} cards to ${col.name}!`);
                  setBatchCards([]);
                  setShowCollectionPicker(false);
                  setTimeout(() => onClose(), 1500);
                }}
                className="w-full text-left px-4 py-3.5 text-sm font-medium rounded-xl mb-1.5 active:opacity-70 transition-colors text-text bg-white border border-[rgba(0,0,0,0.06)] hover:bg-bg-surface"
              >
                {col.name}
              </button>
            ))}
            <button onClick={() => setShowCollectionPicker(false)} className="w-full text-sm text-text-muted py-2 mt-1 active:opacity-70">
              Cancel — keep scanning
            </button>
          </div>
        )}

        {/* ═══ BOTTOM ACTIONS (hidden when batch has cards — combined above) ═══ */}
        {mode !== "choose" && !resultCard && matchedCards.length === 0 && !showCollectionPicker && !(mode === "add-batch" && batchCards.length > 0) && (
          <div className="flex-none flex gap-2 px-4 py-3 border-t border-[rgba(0,0,0,0.04)]">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { /* TODO: file scan */ } }} />
            {!scanning && cameraReady && (
              <button onClick={startScanning} className="flex-1 border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70">
                Scan again
              </button>
            )}
            <button onClick={() => setShowManualEntry(true)} className="flex-1 border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-2.5 rounded-xl active:opacity-70">
              Enter code
            </button>
          </div>
        )}

        {/* Manual entry */}
        {showManualEntry && (
          <CardPicker
            onPick={(card) => { setShowManualEntry(false); if (mode === "price-check") setResultCard(card); else { setMatchedCards([card]); } }}
            onPickMultiple={(cards) => { if (cards[0]) { setShowManualEntry(false); setMatchedCards(cards); } }}
            onCancel={() => setShowManualEntry(false)}
          />
        )}

        {/* Status toast for add-single */}
        {mode === "add-single" && !showCollectionPicker && !resultCard && status.includes("Added") && (
          <div className="flex-none px-4 py-3 text-center">
            <div className="text-sm font-medium text-[#059669]">{status}</div>
          </div>
        )}
      </div>

      {/* ═══ CARD PREVIEW OVERLAY ═══ */}
      {previewCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setPreviewCard(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-[300px] w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewCard.imageUrl}
              alt={previewCard.cardName}
              className="w-full rounded-2xl aspect-[63/88] object-contain"
            />
            <div className="text-center mt-3">
              <div className="text-white text-sm font-semibold">{previewCard.cardName}</div>
              <div className="text-white/60 text-xs mt-0.5">{previewCard.cardSetId} · {previewCard.rarity}</div>
              {previewCard.marketPrice != null && previewCard.marketPrice > 0 && (
                <div className="font-mono text-sm font-semibold text-[#059669] mt-1">{formatPrice(previewCard.marketPrice)}</div>
              )}
            </div>
            <button
              onClick={() => setPreviewCard(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-text shadow-lg active:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
