"use client";

import { useSyncExternalStore } from "react";
import { DisplayAd } from "./display-ad";

const WIDE_SIZE: [number, number] = [728, 90]; // Leaderboard
const NARROW_SIZE: [number, number] = [320, 50]; // Mobile Banner
const BREAKPOINT_PX = 768;

// A full-width, low-height banner that swaps to a narrower/shorter creative
// below BREAKPOINT_PX instead of rendering a fixed 728px-wide desktop unit
// that would overflow a phone-width viewport.
export function BottomBannerAd() {
  const wide = useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(min-width: ${BREAKPOINT_PX}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(min-width: ${BREAKPOINT_PX}px)`).matches,
    // SSR/first client render can't know the real viewport width — assume
    // narrow until useSyncExternalStore reconciles post-hydration, avoiding
    // a hydration mismatch from reading matchMedia during render.
    () => false,
  );

  return (
    <div className="flex justify-center">
      {/* key forces a fresh mount (new GPT slot) if the viewport crosses
          the breakpoint mid-session — DisplayAd defines its slot once at
          mount and won't resize an already-defined slot. */}
      <DisplayAd key={wide ? "wide" : "narrow"} size={wide ? WIDE_SIZE : NARROW_SIZE} />
    </div>
  );
}
