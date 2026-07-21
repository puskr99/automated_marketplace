"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DisplayAd } from "./display-ad";

// 160x600 "Wide Skyscraper" — the standard IAB vertical format for a
// margin/sidebar placement. A 250x250 square (the old value here) is a
// medium-rectangle format meant for in-content placements, not a side rail.
const AD_SIZE: [number, number] = [160, 600];
// Ad box width + the left-2/right-2 offset + a little breathing room from
// the content edge, per side.
const MARGIN_NEEDED_PX = AD_SIZE[0] + 8 + 8;

type Props = {
  /** max-width (px) of this page's centered content column — e.g. max-w-3xl = 768. */
  contentWidthPx: number;
};

// Two slots pinned to the left/right viewport edges, in the margin outside
// the page's centered content column. Only mounted (so only requested) once
// JS confirms the viewport is wide enough to show them — never
// rendered-then-hidden with CSS, so a narrow viewport never fires an ad
// request it can't display. Fixed positioning keeps these out of the page's
// own layout entirely, and pinning them to the far edges keeps them well
// clear of any interactive control in the centered column (search, filters,
// the worker chat input) — Google's ad placement policy prohibits ads close
// enough to controls to risk accidental clicks.
//
// The width threshold is derived from contentWidthPx rather than a single
// shared constant, so a page with a narrower content column needs a smaller
// viewport before these show. Worker listing (workers/page.tsx) used to be
// max-w-5xl (1024px) specifically because at common laptop widths (~1366px)
// that only left 171px of margin per side — not enough for any legible ad
// box plus padding, no matter how this component's size/threshold were
// tuned. It's now max-w-3xl (768px), matching worker detail, to actually
// leave room for these; that's a real, deliberate trade-off (narrower
// content column, tighter 2-up card grid), not a magic-number fix.
//
// Google's public test ad unit (the default for
// NEXT_PUBLIC_GAM_DISPLAY_AD_UNIT_PATH) only confirms creatives for the
// sizes shown in Google's own docs for it (300x250, 728x90) — so 160x600
// will likely come back no-fill against that specific demo unit even where
// there's room to show it. Check the console for this component's
// slotRenderEnded logs (see display-ad.tsx) to tell a real no-fill apart
// from this viewport gate. Point NEXT_PUBLIC_GAM_DISPLAY_AD_UNIT_PATH at a
// real GAM ad unit configured to serve 160x600 to see actual creatives.
export function MarginAds({ contentWidthPx }: Props) {
  const minViewportWidth = contentWidthPx + MARGIN_NEEDED_PX * 2;
  const query = `(min-width: ${minViewportWidth}px)`;

  const show = useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // SSR/first client render can't know the real viewport width — assume
    // narrow (no ads) until useSyncExternalStore reconciles with the real
    // client-side value post-hydration. Avoids a hydration mismatch from
    // reading window.matchMedia during render.
    () => false,
  );

  useEffect(() => {
    if (!show) {
      console.info(
        `[MarginAds] hidden — window.innerWidth=${window.innerWidth} < required ${minViewportWidth} ` +
          `(content ${contentWidthPx}px + ${MARGIN_NEEDED_PX}px margin per side). Widen the window to see these.`,
      );
    }
  }, [show, minViewportWidth, contentWidthPx]);

  if (!show) return null;

  return (
    <>
      <div className="fixed left-2 top-32 z-10">
        <DisplayAd size={AD_SIZE} />
      </div>
      <div className="fixed right-2 top-32 z-10">
        <DisplayAd size={AD_SIZE} />
      </div>
    </>
  );
}
