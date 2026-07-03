"use client";

import { useState } from "react";

// Real protocol logos from DefiLlama's icon CDN (the same source we pull
// live TVL data from). Falls back to a colored-initial glyph if the image
// 404s or the CDN is unreachable, never a broken-image icon.
export default function ProtocolLogo({ src, name, glyph, accent, size = 32 }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-mono font-semibold"
        style={{ width: size, height: size, backgroundColor: `${accent}22`, color: accent, fontSize: size * 0.4 }}
      >
        {glyph}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-ink-raised object-contain"
      style={{ width: size, height: size }}
    />
  );
}
