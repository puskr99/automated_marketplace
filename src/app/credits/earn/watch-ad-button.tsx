"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSc } from "@/lib/currency";

// Public value, safe to expose client-side — it's just inventory routing,
// not a secret. Defaults to Google's own published test rewarded ad unit so
// this works before a real Ad Manager network/ad unit exists; swap in the
// real one via env once you have a GAM account. Note: ad exchanges generally
// won't serve to a `localhost` origin at all — no-fill locally is expected
// even with a real, correctly-configured ad unit. Test against a public
// hostname (a tunnel like ngrok works) to see a real ad render.
const AD_UNIT_PATH =
  process.env.NEXT_PUBLIC_GAM_REWARDED_AD_UNIT_PATH ?? "/22639388115/rewarded_web_example";

// GPT never fires rewardedSlotReady on a no-fill response (see
// slotRenderEnded handling below) — but if gpt.js itself never loads at all
// (ad blocker, network issue), *nothing* fires and the UI would otherwise
// wait forever. This is the backstop for that case specifically.
const AD_LOAD_TIMEOUT_MS = 15_000;

type State = "idle" | "starting" | "waiting" | "playing" | "crediting";

// Real Google Ad Manager rewarded ads via Google Publisher Tag (GPT) —
// google.ima isn't the right SDK here, GPT's out-of-page REWARDED format is.
// gpt.js itself is loaded once, globally, in app/layout.tsx (shared with the
// standard display ads in components/display-ad.tsx). GAM's server-side
// verification for rewarded ads is an app-only feature and doesn't exist for
// web, so the reward is still a client-reported event; see lib/ad-reward.ts
// for the signed single-use session token that's the practical substitute.
export function WatchAdButton() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const slotRef = useRef<GoogletagSlot | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAdTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function destroySlot() {
    if (slotRef.current) {
      window.googletag.destroySlots([slotRef.current]);
      slotRef.current = null;
    }
  }

  function failToLoad(reason: string) {
    clearAdTimeout();
    destroySlot();
    setError(reason);
    setState("idle");
  }

  useEffect(() => {
    return () => {
      clearAdTimeout();
      destroySlot();
    };
  }, []);

  // Farming rewarded ads by minimizing/backgrounding the tab (so the ad
  // "plays" unattended) is a known abuse pattern — invalidate the session
  // the moment the tab is hidden while an ad is loading or playing. Doesn't
  // touch "crediting": by then rewardedSlotGranted already fired for real.
  useEffect(() => {
    if (state !== "waiting" && state !== "playing") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        failToLoad("Ad view cancelled — keep this tab visible while it plays.");
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function creditReward() {
    setState("crediting");
    try {
      const res = await fetch("/api/credits/ads/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "couldn't credit reward");
      // Reward alternates 1¢/0¢ per watch (= 2 SC / 0 SC) to land on a
      // 1 SC/watch average (see lib/ad-reward.ts) — a 0 SC result is
      // expected on every other ad, not a failure.
      setMessage(
        data.rewardedCents > 0
          ? `+${formatSc(data.rewardedCents)} — ${data.rewardsRemainingToday} left today`
          : `Counted — next ad earns ${formatSc(1)} (${data.rewardsRemainingToday} left today)`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      tokenRef.current = null;
      setState("idle");
    }
  }

  async function watchAd() {
    setError(null);
    setMessage(null);
    setState("starting");

    try {
      const res = await fetch("/api/credits/ads/watch/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "couldn't start ad session");
      tokenRef.current = data.token;
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setState("idle");
      return;
    }

    setState("waiting");
    timeoutRef.current = setTimeout(
      () => failToLoad("Ad didn't load — check your connection or ad blocker and try again."),
      AD_LOAD_TIMEOUT_MS,
    );

    // Queue-then-populate: gpt.js may not have finished loading yet, so we
    // push onto window.googletag.cmd rather than calling googletag directly.
    // The stub assignment only has `cmd` until gpt.js runs and replaces it.
    if (!window.googletag) {
      window.googletag = { cmd: [] } as unknown as Window["googletag"];
    }

    window.googletag.cmd.push(() => {
      const slot = window.googletag.defineOutOfPageSlot(
        AD_UNIT_PATH,
        window.googletag.enums.OutOfPageFormat.REWARDED,
      );

      if (!slot) {
        failToLoad("Rewarded ads aren't available on this device right now.");
        return;
      }

      slotRef.current = slot;
      slot.addService(window.googletag.pubads());

      window.googletag.pubads().addEventListener("rewardedSlotReady", (event) => {
        clearAdTimeout();
        setState("playing");
        event.makeRewardedVisible();
      });

      window.googletag.pubads().addEventListener("rewardedSlotGranted", () => {
        creditReward();
      });

      window.googletag.pubads().addEventListener("rewardedSlotClosed", () => {
        destroySlot();
        setState((current) => (current === "crediting" ? current : "idle"));
      });

      // GPT fires this for every slot render, fill or no-fill — it's the
      // only signal for "no ad available" (rewardedSlotReady simply never
      // fires in that case, which is what caused this to hang before).
      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot === slot && event.isEmpty) {
          failToLoad("No ad available right now — try again in a bit.");
        }
      });

      window.googletag.enableServices();
      window.googletag.display(slot);
    });
  }

  const busy = state !== "idle";
  const label =
    state === "starting"
      ? "Starting…"
      : state === "waiting"
        ? "Loading ad…"
        : state === "playing"
          ? "Watching…"
          : state === "crediting"
            ? "Crediting…"
            : "Watch an ad";

  return (
    <div>
      <Button type="button" onClick={watchAd} disabled={busy}>
        {!busy && <PlayCircle className="size-4" />}
        {busy && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {message && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-500">{message}</p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
