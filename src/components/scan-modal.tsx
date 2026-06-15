"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogCard } from "@/lib/catalog/types";

type ScanResult = {
  codes: string[];
  text: string;
  bestGuess: string | null;
};

export function ScanModal({
  onResult,
  onClose,
}: {
  onResult: (card: CatalogCard) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanGenRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState("Starting camera...");
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [matchedCards, setMatchedCards] = useState<CatalogCard[]>([]);

  // Start camera
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not available on this device");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
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

  // Start auto-scanning when camera is ready
  useEffect(() => {
    if (cameraReady) {
      startScanning();
    }
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]);

  function startScanning() {
    stopScanning();
    scanGenRef.current++;
    setScanning(true);

    // Fire immediately then every 800ms
    scanFrame();
    scanTimerRef.current = setInterval(scanFrame, 800);
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
    const w = Math.min(480, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
  }

  const scanFrame = useCallback(async () => {
    const gen = scanGenRef.current;
    const base64 = captureFrame();
    if (!base64) return;

    try {
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (gen !== scanGenRef.current) return;

      const data: ScanResult = await res.json();

      if (data.codes && data.codes.length > 0) {
        stopScanning();
        setStatus(`Found: ${data.codes[0]}`);
        // Look up the card in catalog
        await lookupCard(data.codes[0]);
      } else if (data.bestGuess) {
        setStatus(`Seeing: ${data.bestGuess}`);
      } else if (data.text) {
        setStatus(
          `Reading: ${data.text.replace(/\n/g, " ").trim().slice(0, 50)}`
        );
      }
    } catch {
      // Network error — keep scanning
    }
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
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

      try {
        const res = await fetch("/api/scan-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const data: ScanResult = await res.json();

        if (data.codes && data.codes.length > 0) {
          setStatus(`Found: ${data.codes[0]}`);
          await lookupCard(data.codes[0]);
        } else {
          setStatus(
            data.bestGuess
              ? `Detected: ${data.bestGuess} — not a recognized card code`
              : "Card not recognized — try a clearer photo"
          );
        }
      } catch {
        setStatus("API error — try again");
      }
    };
    img.src = URL.createObjectURL(file);
  }

  async function lookupCard(code: string) {
    try {
      const res = await fetch(
        `/api/search-cards?q=${encodeURIComponent(code)}`
      );
      const cards: CatalogCard[] = await res.json();
      if (cards.length > 0) {
        setMatchedCards(cards.slice(0, 5));
        setStatus(`Matched: ${cards[0].cardName}`);
      } else {
        setMatchedCards([]);
        setStatus(`Found code ${code} but no catalog match`);
      }
    } catch {
      setStatus(`Found code ${code} — catalog lookup failed`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-bg-elevated border border-[rgba(255,255,255,0.06)] rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
          <h2 className="font-semibold text-sm text-text">Scan Card</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Camera */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {scanning && (
            <div className="absolute inset-0 border-2 border-accent/30 rounded-lg m-4 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="px-4 py-3 text-center text-sm text-text-muted">
          {status}
        </div>

        {/* Matched cards */}
        {matchedCards.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.04)]">
            <div className="px-3 py-1.5 text-[10px] font-mono tracking-[.08em] uppercase text-text-dim">
              Select a match
            </div>
            {matchedCards.map((card, i) => (
              <button
                key={card.cardSetId + i}
                onClick={() => onResult(card)}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(59,130,246,0.08)] transition-colors"
              >
                <div className="relative w-6 h-[33px] flex-none rounded overflow-hidden bg-[#1C1C1F]">
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <span className="font-mono text-[11px] text-text-dim flex-none w-[72px]">
                  {card.cardSetId}
                </span>
                <span className="flex-1 text-[13px] font-semibold text-text truncate">
                  {card.cardName}
                </span>
                {card.marketPrice != null && card.marketPrice > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#4ADE80]">
                    €{card.marketPrice.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
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
            className="flex-1 bg-bg-surface border border-[rgba(255,255,255,0.06)] text-text font-semibold text-sm py-2.5 px-4 rounded-lg hover:bg-[#27272A] transition-colors"
          >
            Upload photo
          </button>
          {!scanning && cameraReady && matchedCards.length === 0 && (
            <button
              onClick={startScanning}
              className="flex-1 bg-accent text-white font-semibold text-sm py-2.5 px-4 rounded-lg hover:bg-accent-hover transition-colors"
            >
              Scan again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
