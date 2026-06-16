"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";
import { ScanResultScreen } from "./scan-result-screen";
import { CardPicker } from "./card-picker";
import { useRegion } from "./region-selector";

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

/** Extract card codes from text using regex (runs instantly, no API) */
function extractCodesLocal(text: string): string[] {
  const codes: string[] = [];
  const up = text.toUpperCase();
  const re = /(OP|ST|EB|PRB)\s*[O0]?(\d{1,2})\s*[-\s.]\s*(\d{2,3})/g;
  let m;
  while ((m = re.exec(up)) !== null) {
    codes.push(m[1] + m[2].padStart(2, "0") + "-" + m[3].padStart(3, "0"));
  }
  const pre = /P\s*[-\s.]\s*(\d{3})/g;
  while ((m = pre.exec(up)) !== null) codes.push("P-" + m[1]);
  return [...new Set(codes)];
}

/** Match text against card index locally */
function matchLocalIndex(text: string, index: CardIndex): CardIndex {
  if (!text || text.length < 3) return [];
  const textUp = text.toUpperCase();

  // First try code match
  const codes = extractCodesLocal(text);
  if (codes.length > 0) {
    const codeMatches = index.filter((c) =>
      codes.some((code) => c.id.toUpperCase() === code)
    );
    if (codeMatches.length > 0) return codeMatches;
  }

  // Then try name match — score each card
  const scored = index
    .map((card) => {
      let score = 0;
      const nameUp = card.n.toUpperCase();
      const words = nameUp.split(/\s+/).filter((w) => w.length > 2);

      for (const word of words) {
        if (textUp.includes(word)) score += word.length;
      }

      // Full name match is very strong
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

  const [status, setStatus] = useState("Starting camera...");
  const [confidence, setConfidence] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedCards, setMatchedCards] = useState<CatalogCard[]>([]);
  const [resultCard, setResultCard] = useState<CatalogCard | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const wasRescannedRef = useRef(false); // After rescan, don't auto-lock — show candidate list
  const { formatPrice } = useRegion();

  // Load card index for local matching
  useEffect(() => {
    fetch("/api/card-index")
      .then((r) => r.json())
      .then((data: CardIndex) => { cardIndexRef.current = data; })
      .catch(() => {});
  }, []);

  // Start camera — portrait on mobile
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not available on this device");
      return;
    }

    const isMobile = window.innerWidth < 640;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: isMobile ? { ideal: 720 } : { ideal: 1280 },
          height: isMobile ? { ideal: 1280 } : { ideal: 960 },
          aspectRatio: isMobile ? { ideal: 3 / 4 } : { ideal: 4 / 3 },
        },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
        setStatus("Point camera at a card");
      })
      .catch(() => {
        setStatus("Camera access denied — use file upload instead");
      });

    return () => {
      stopScanning();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraReady) startScanning();
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]);

  function startScanning() {
    stopScanning();
    scanGenRef.current++;
    setScanning(true);
    pendingScanRef.current = false;
    visionCallCount.current = 0;
    setConfidence(0);

    scanFrame();
    // Fast interval — most work is local, only occasional Vision API calls
    scanTimerRef.current = setInterval(scanFrame, 400);
  }

  function stopScanning() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanning(false);
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement("canvas");
    // Smaller image = faster upload when we do need Vision API
    const w = Math.min(480, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;
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

      // First frame uses full detection (artwork + text), subsequent use fast text-only
      const useFullDetection = visionCallCount.current <= 1 || visionCallCount.current % 3 === 0;
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, fast: !useFullDetection }),
      });

      if (gen !== scanGenRef.current) { pendingScanRef.current = false; return; }

      const data: ScanResult = await res.json();

      // Try local index match with OCR text
      const allText = [data.text, data.bestGuess, data.cardName, ...(data.labels ?? [])].filter(Boolean).join(" ");
      const localMatches = matchLocalIndex(allText, cardIndexRef.current);

      if (data.codes && data.codes.length > 0) {
        const code = data.codes[0];
        // Check if this code has multiple art variants
        const variantCount = cardIndexRef.current.filter(
          (c) => c.id.toUpperCase() === code.toUpperCase()
        ).length;

        if (variantCount <= 1) {
          // Single variant — done!
          stopScanning();
          setConfidence(100);
          setStatus(`Found: ${code}`);
          await lookupCard(code);
        } else {
          // Multiple variants — need PASS 2 with full detection for artwork matching
          setConfidence(70);
          setStatus(`Found ${code} — identifying artwork...`);

          const res2 = await fetch("/api/scan-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64, fast: false }),
          });

          if (gen !== scanGenRef.current) { pendingScanRef.current = false; return; }

          const fullData: ScanResult = await res2.json();
          stopScanning();
          setConfidence(100);
          setStatus(`Found: ${code} (${variantCount} variants)`);

          // Use web detection image URLs + labels to rank variants
          await lookupCardWithVariants(code, fullData);
        }
      } else if (localMatches.length > 0) {
        stopScanning();
        setConfidence(90);
        setStatus(`Matched: ${localMatches[0].n}`);
        await lookupCards(localMatches.map((m) => m.id));
      } else if (data.text && data.text.length > 10) {
        // Got text but no match — if this is the 3rd+ attempt, try full detection
        if (visionCallCount.current >= 3 && visionCallCount.current % 3 === 0) {
          setConfidence(40);
          setStatus("Trying deeper detection...");
          const res2 = await fetch("/api/scan-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64, fast: false }),
          });
          if (gen !== scanGenRef.current) { pendingScanRef.current = false; return; }
          const fullData: ScanResult = await res2.json();

          const fullText = [fullData.text, fullData.bestGuess, fullData.cardName, ...(fullData.labels ?? [])].filter(Boolean).join(" ");
          const fullMatches = matchLocalIndex(fullText, cardIndexRef.current);

          if (fullData.codes && fullData.codes.length > 0) {
            stopScanning();
            setConfidence(100);
            setStatus(`Found: ${fullData.codes[0]}`);
            await lookupCard(fullData.codes[0]);
          } else if (fullMatches.length > 0) {
            stopScanning();
            setConfidence(85);
            setStatus(`Matched: ${fullMatches[0].n}`);
            await lookupCards(fullMatches.map((m) => m.id));
          } else {
            setConfidence(Math.min(50, visionCallCount.current * 8));
            setStatus("Hold steady...");
          }
        } else {
          setConfidence(Math.min(50, visionCallCount.current * 12));
          setStatus("Reading... hold steady");
        }
      } else {
        setConfidence(Math.min(20, visionCallCount.current * 5));
        setStatus("Scanning...");
      }
    } catch {
      // Network error — keep scanning
    }
    pendingScanRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scanFile(file: File) {
    setStatus("Reading card...");
    stopScanning();

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const w = Math.min(1280, img.width);
      const h = Math.round((w * img.height) / img.width);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      try {
        const res = await fetch("/api/scan-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const data: ScanResult = await res.json();

        if (data.codes && data.codes.length > 0) {
          setConfidence(100);
          setStatus(`Found: ${data.codes[0]}`);
          await lookupCard(data.codes[0]);
        } else {
          // Try local matching
          const allText = [data.text, data.bestGuess, data.cardName, ...(data.labels ?? [])].filter(Boolean).join(" ");
          const localMatches = matchLocalIndex(allText, cardIndexRef.current);
          if (localMatches.length > 0) {
            setConfidence(90);
            setStatus(`Matched: ${localMatches[0].n}`);
            await lookupCards(localMatches.map((m) => m.id));
          } else {
            setStatus(
              data.bestGuess
                ? `Detected: ${data.bestGuess} — try a clearer photo`
                : "Card not recognized — try a clearer photo"
            );
          }
        }
      } catch {
        setStatus("API error — try again");
      }
    };
    img.src = URL.createObjectURL(file);
  }

  async function lookupCardWithVariants(code: string, scanData: ScanResult) {
    // Get all variants from the card index
    const variants = cardIndexRef.current.filter(
      (c) => c.id.toUpperCase() === code.toUpperCase()
    );

    if (variants.length <= 1) {
      return lookupCard(code);
    }

    // Use web detection matching image URLs to identify which artwork
    const matchUrls = (scanData.matchingImageUrls ?? []).join(" ").toLowerCase();
    const labels = (scanData.labels ?? []).join(" ").toLowerCase();
    const bestGuess = (scanData.bestGuess ?? "").toLowerCase();

    // Score each variant by how well its image URL matches web detection results
    const scored = variants.map((v) => {
      let score = 0;
      const imgLower = v.img.toLowerCase();

      // Check if the variant's image URL (or parts of it) appear in web matches
      const imgParts = imgLower.split("/").pop()?.split("_") ?? [];
      for (const part of imgParts) {
        if (part.length > 4 && matchUrls.includes(part)) score += 20;
      }

      // Check if variant name appears in labels/best guess
      const nameLower = v.n.toLowerCase();
      if (labels.includes(nameLower)) score += 10;
      if (bestGuess.includes(nameLower)) score += 10;

      // Check for "alt art" or artist name mentions
      if ((labels.includes("alt") || labels.includes("alternate")) && v.img.includes("_")) {
        score += 5; // Might be alt art
      }

      return { variant: v, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Convert to CatalogCard format and show all variants
    const catalogCards: CatalogCard[] = scored.map((s) => ({
      cardSetId: s.variant.id,
      cardName: s.variant.n,
      setName: "",
      setId: "",
      rarity: s.variant.r,
      cardColor: s.variant.c,
      cardType: "",
      cardCost: "",
      cardPower: "",
      imageUrl: s.variant.img,
      marketPrice: null,
      inventoryPrice: null,
    }));

    setMatchedCards(catalogCards);
    setStatus(`${code} — ${variants.length} variants, pick yours`);
  }

  async function lookupCard(code: string) {
    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(code)}`);
      const cards: CatalogCard[] = await res.json();
      if (cards.length > 0) {
        setMatchedCards(cards.slice(0, 5));
        setStatus(`Matched: ${cards[0].cardName}`);
      } else {
        // Fall back to local index
        const local = cardIndexRef.current.filter((c) => c.id.toUpperCase() === code.toUpperCase());
        if (local.length > 0) {
          const localCards = local.map((c) => ({
            cardSetId: c.id, cardName: c.n, setName: "", setId: "",
            rarity: c.r, cardColor: c.c, cardType: "", cardCost: "",
            cardPower: "", imageUrl: c.img, marketPrice: null, inventoryPrice: null,
          }));
          setMatchedCards(localCards);
          setStatus(`Matched: ${local[0].n}`);
        } else {
          setMatchedCards([]);
          setStatus(`Found code ${code} but no match`);
        }
      }
    } catch {
      setStatus(`Found code ${code} — lookup failed`);
    }
  }

  async function lookupCards(codes: string[]) {
    // Try API for the first code
    try {
      const res = await fetch(`/api/search-cards?q=${encodeURIComponent(codes[0])}`);
      const cards: CatalogCard[] = await res.json();
      if (cards.length > 0) {
        setMatchedCards(cards.slice(0, 5));
        return;
      }
    } catch { /* fall through */ }

    // Fall back to local index
    const local = codes.flatMap((code) =>
      cardIndexRef.current.filter((c) => c.id.toUpperCase() === code.toUpperCase())
    );
    if (local.length > 0) {
      setMatchedCards(local.slice(0, 5).map((c) => ({
        cardSetId: c.id, cardName: c.n, setName: "", setId: "",
        rarity: c.r, cardColor: c.c, cardType: "", cardCost: "",
        cardPower: "", imageUrl: c.img, marketPrice: null, inventoryPrice: null,
      })));
    }
  }

  const confidenceColor =
    confidence >= 80 ? "#059669" : confidence >= 40 ? "#FACC15" : "rgba(0,0,0,0.15)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(0,0,0,0.06)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.04)]">
          <h2 className="font-semibold text-sm text-text">
            {quickMode ? "Quick Scan" : "Scan Card"}
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text active:opacity-70 text-lg p-1 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Camera — hidden once a result is locked in */}
        {!resultCard && (
          <>
            <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-white overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-accent/30 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[rgba(0,0,0,0.5)]">
                    <div
                      className="h-full transition-all duration-300 ease-out rounded-r-full"
                      style={{ width: `${confidence}%`, backgroundColor: confidenceColor }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-text-muted">{status}</span>
              {scanning && confidence > 0 && (
                <span className="text-xs font-mono font-semibold" style={{ color: confidenceColor }}>
                  {confidence}%
                </span>
              )}
            </div>
          </>
        )}

        {/* Result screen — takes over full modal when a card is locked in */}
        {resultCard && !showManualEntry && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ScanResultScreen
              card={resultCard}
              onRescan={() => {
                setResultCard(null);
                setMatchedCards([]);
                setConfidence(0);
                visionCallCount.current = 0;
                wasRescannedRef.current = true;
                startScanning();
              }}
              onManualEntry={() => setShowManualEntry(true)}
              onClose={onClose}
            />
          </div>
        )}

        {!resultCard && matchedCards.length > 0 && (
          <div className="border-t border-[rgba(0,0,0,0.04)]">
            <div className="px-3 py-2 text-xs font-medium text-text-dim uppercase tracking-wider">
              {matchedCards.length === 1 ? "Is this your card?" : "Pick your card"}
            </div>
            {matchedCards.map((card, i) => (
              <div key={card.cardSetId + i} className="border-b border-[rgba(0,0,0,0.04)] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-[67px] flex-none rounded-md overflow-hidden bg-[#E4E4E7]">
                    <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-text block truncate">{card.cardName}</span>
                    <span className="text-xs text-text-dim">{card.cardSetId} · {card.rarity} · {card.cardColor}</span>
                  </span>
                  {card.marketPrice != null && card.marketPrice > 0 && (
                    <span className="font-mono text-sm font-semibold text-[#059669] flex-none">
                      {formatPrice(card.marketPrice)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => setResultCard(card)}
                    className="flex-1 bg-text text-bg font-medium text-sm py-2 px-4 rounded-xl active:opacity-80 transition-colors"
                  >
                    {matchedCards.length === 1 ? "Yes, check price" : "Select"}
                  </button>
                  <button
                    onClick={() => {
                      setMatchedCards([]);
                      setConfidence(0);
                      visionCallCount.current = 0;
                      startScanning();
                    }}
                    className="bg-bg-surface border border-[rgba(0,0,0,0.08)] text-text font-medium text-sm py-2 px-4 rounded-xl active:opacity-70 transition-colors"
                  >
                    Rescan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showManualEntry && (
          <CardPicker
            onPick={(card) => {
              setShowManualEntry(false);
              setResultCard(card);
            }}
            onPickMultiple={(cards) => {
              if (cards[0]) {
                setShowManualEntry(false);
                setResultCard(cards[0]);
              }
            }}
            onCancel={() => setShowManualEntry(false)}
          />
        )}

        {/* Bottom actions — hidden when result screen is showing */}
        {!resultCard && (
          <div className="flex gap-2 px-4 py-3 border-t border-[rgba(0,0,0,0.04)]">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) scanFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 bg-bg-surface border border-[rgba(0,0,0,0.06)] text-text font-semibold text-sm py-3 px-4 rounded-lg hover:bg-[#E4E4E7] active:opacity-80 transition-colors"
            >
              Upload photo
            </button>
            {!scanning && cameraReady && matchedCards.length === 0 && (
              <button
                onClick={startScanning}
                className="flex-1 border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-3 px-4 rounded-lg hover:bg-[rgba(0,0,0,0.06)] active:opacity-70 transition-colors"
              >
                Scan again
              </button>
            )}
            {!scanning && matchedCards.length === 0 && (
              <button
                onClick={() => setShowManualEntry(true)}
                className="flex-1 border border-[rgba(0,0,0,0.1)] text-text font-medium text-sm py-3 px-4 rounded-lg hover:bg-[rgba(0,0,0,0.06)] active:opacity-70 transition-colors"
              >
                Enter code
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
