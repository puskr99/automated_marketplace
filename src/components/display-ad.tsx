"use client";

import { useEffect, useId, useRef, useState } from "react";

// Public value, safe to expose client-side. Defaults to Google's own
// published test display ad unit so this renders before a real Ad Manager
// network/ad unit exists; swap in the real one via env once you have a GAM
// account. Same caveat as the rewarded ad unit: most ad exchanges won't
// serve to a `localhost` origin at all.
const AD_UNIT_PATH =
  process.env.NEXT_PUBLIC_GAM_DISPLAY_AD_UNIT_PATH ?? "/6355419/Travel/Europe/France/Paris";

type Props = {
  size: [number, number];
  className?: string;
};

// Standard (non-rewarded) Google Publisher Tag display ad, fixed at one
// size — callers that only want the ad on wide viewports should not mount
// this at all below their breakpoint (see MarginAds) rather than rendering
// it and hiding it with CSS, so a narrow viewport never requests an ad it
// won't show. gpt.js is loaded once, globally, in app/layout.tsx; this only
// defines and requests one slot. Labeled "Advertisement" per Google's
// placement policy (ads must not be mistakable for site content/navigation).
export function DisplayAd({ size, className }: Props) {
  const rawId = useId();
  const divId = `gpt-ad-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const slotRef = useRef<GoogletagSlot | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!window.googletag) {
      window.googletag = { cmd: [] } as unknown as Window["googletag"];
    }

    // Temporary diagnostics — narrows down "ad doesn't show" reports to one
    // of: defineSlot itself returning null (bad ad unit path/size), a
    // request going out and coming back no-fill (slotRenderEnded, isEmpty),
    // or nothing happening at all within 5s (gpt.js/the request blocked —
    // ad blockers commonly allow rewarded/video requests through while
    // blocking standard display ad requests specifically). Remove once
    // display ads are confirmed working end to end.
    let renderEnded = false;
    const watchdog = setTimeout(() => {
      if (!renderEnded) {
        console.warn(
          `[DisplayAd ${divId}] no slotRenderEnded within 5s — request likely never landed ` +
            `(ad blocker blocking the display ad request specifically, or gpt.js never processed the cmd queue).`,
        );
      }
    }, 5000);

    window.googletag.cmd.push(() => {
      const slot = window.googletag.defineSlot(AD_UNIT_PATH, size, divId);
      if (!slot) {
        console.warn(
          `[DisplayAd ${divId}] defineSlot("${AD_UNIT_PATH}", [${size}]) returned null — ` +
            `page/device doesn't support this ad unit/size combination.`,
        );
        setEmpty(true);
        return;
      }

      slotRef.current = slot;
      slot.addService(window.googletag.pubads());

      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot !== slot) return;
        renderEnded = true;
        clearTimeout(watchdog);
        console.info(`[DisplayAd ${divId}] slotRenderEnded, isEmpty=${event.isEmpty}`);
        if (event.isEmpty) setEmpty(true);
      });

      window.googletag.enableServices();
      window.googletag.display(divId);
    });

    return () => {
      clearTimeout(watchdog);
      if (slotRef.current) {
        window.googletag.destroySlots([slotRef.current]);
        slotRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divId]);

  // No-fill collapses the container instead of leaving an empty
  // ad-shaped box (and its "Advertisement" label) sitting in the layout.
  if (empty) return null;

  return (
    <div className={className}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        Advertisement
      </p>
      <div id={divId} style={{ width: size[0], height: size[1] }} />
    </div>
  );
}
