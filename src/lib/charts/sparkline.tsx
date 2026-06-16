"use client";

import { useRef, useEffect, useState } from "react";

export function Sparkline({
  data,
  height = 40,
  color = "#059669",
  negativeColor = "#DC2626",
}: {
  data: number[];
  height?: number;
  color?: string;
  negativeColor?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  if (data.length < 2) {
    return <div ref={containerRef} style={{ height }} className="w-full bg-bg-surface rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? color : negativeColor;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} className="block w-full">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
