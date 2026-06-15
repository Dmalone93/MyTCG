"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

type ScanResult = {
  codes: string[];
  text: string;
  bestGuess: string | null;
  labels: string[];
  cardName: string | null;
  rarity: string | null;
  color: string | null;
};

type CardIndex = Array<{ id: string; n: string; r: string; c: string; img: string }>;

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
      // Every frame hits the API with fast mode (TEXT_DETECTION only, ~300ms vs 1.5s)
      visionCallCount.current++;
      const base64 = captureFrame();
      if (!base64) { pendingScanRef.current = false; return; }

      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, fast: true }),
      });

      if (gen !== scanGenRef.current) { pendingScanRef.current = false; return; }

      const data: ScanResult = await res.json();

      // Try local index match with Vision OCR text
      const allText = [data.text, data.bestGuess, data.cardName, ...(data.labels ?? [])].filter(Boolean).join(" ");
      const localMatches = matchLocalIndex(allText, cardIndexRef.current);

      if (data.codes && data.codes.length > 0) {
        stopScanning();
        setConfidence(100);
        setStatus(`Found: ${data.codes[0]}`);
        await lookupCard(data.codes[0]);
      } else if (localMatches.length > 0) {
        stopScanning();
        setConfidence(90);
        setStatus(`Matched: ${localMatches[0].n}`);
        await lookupCards(localMatches.map((m) => m.id));
      } else if (data.text && data.text.length > 10) {
        setConfidence(Math.min(50, visionCallCount.current * 12));
        setStatus("Reading... hold steady");
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
          setMatchedCards(local.map((c) => ({
            cardSetId: c.id, cardName: c.n, setName: "", setId: "",
            rarity: c.r, cardColor: c.c, cardType: "", cardCost: "",
            cardPower: "", imageUrl: c.img, marketPrice: null, inventoryPrice: null,
          })));
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
    confidence >= 80 ? "#4ADE80" : confidence >= 40 ? "#FACC15" : "rgba(255,255,255,0.2)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
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

        <div className="relative aspect-[3/4] sm:aspect-[4/3] bg-black overflow-hidden">
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

        {matchedCards.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.04)]">
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[.08em] uppercase text-text-dim">
              {quickMode ? "Tap to add" : "Select a match"}
            </div>
            {matchedCards.map((card, i) => (
              <button
                key={card.cardSetId + i}
                onClick={async () => {
                  await onResult(card);
                  if (quickMode) {
                    setMatchedCards([]);
                    setConfidence(0);
                    visionCallCount.current = 0;
                    setStatus("Scan next card...");
                    setTimeout(() => startScanning(), 300);
                  }
                }}
                className="flex items-center gap-2.5 w-full text-left px-3 py-3 sm:py-2 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(59,130,246,0.08)] active:opacity-80 transition-colors"
              >
                <div className="relative w-8 h-[44px] flex-none rounded overflow-hidden bg-[#1C1C1F]">
                  <img src={card.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold text-text block truncate">
                    {card.cardName}
                  </span>
                  <span className="text-[10px] text-text-dim">
                    {card.cardSetId} · {card.rarity} · {card.cardColor}
                  </span>
                </span>
                {card.marketPrice != null && card.marketPrice > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#4ADE80] flex-none">
                    €{card.marketPrice.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 px-4 py-3 border-t border-[rgba(255,255,255,0.04)]">
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
            className="flex-1 bg-bg-surface border border-[rgba(255,255,255,0.06)] text-text font-semibold text-sm py-3 px-4 rounded-lg hover:bg-[#27272A] active:opacity-80 transition-colors"
          >
            Upload photo
          </button>
          {!scanning && cameraReady && matchedCards.length === 0 && (
            <button
              onClick={startScanning}
              className="flex-1 bg-accent text-white font-semibold text-sm py-3 px-4 rounded-lg hover:bg-accent-hover active:opacity-80 transition-colors"
            >
              Scan again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
