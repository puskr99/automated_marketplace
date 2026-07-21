// Minimal ambient typings for the Google Publisher Tag (GPT) surface used
// across the app: rewarded ads (app/credits/earn/watch-ad-button.tsx) and
// standard display ads (components/display-ad.tsx) — just the slice of
// https://developers.google.com/publisher-tag/reference we call.
export {};

declare global {
  interface GoogletagPubadsService {
    addEventListener(
      type: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed",
      listener: (event: GoogletagRewardEvent) => void,
    ): void;
    addEventListener(
      type: "slotRenderEnded",
      listener: (event: GoogletagSlotRenderEndedEvent) => void,
    ): void;
  }

  // GPT returns the same Slot shape for both out-of-page (rewarded) and
  // standard display slots.
  interface GoogletagSlot {
    addService(service: GoogletagPubadsService): GoogletagSlot;
  }

  interface GoogletagRewardEvent {
    makeRewardedVisible(): void;
    payload: { type: string; amount: number } | null;
  }

  // Fires for every slot request, fill or no-fill — the only reliable signal
  // that a slot request came back empty (no ad to show). GPT never fires
  // rewardedSlotReady in the no-fill case, so without this a rewarded ad
  // hangs forever waiting for an event that isn't coming; for standard
  // display slots it's how display-ad.tsx knows to collapse the container
  // instead of leaving an empty box.
  interface GoogletagSlotRenderEndedEvent {
    slot: GoogletagSlot;
    isEmpty: boolean;
  }

  interface Window {
    googletag: {
      cmd: Array<() => void>;
      enums: { OutOfPageFormat: { REWARDED: unknown } };
      defineOutOfPageSlot(
        adUnitPath: string,
        format: unknown,
      ): GoogletagSlot | null;
      defineSlot(
        adUnitPath: string,
        size: [number, number] | [number, number][],
        divId: string,
      ): GoogletagSlot | null;
      pubads(): GoogletagPubadsService;
      enableServices(): void;
      display(slotOrDivId: GoogletagSlot | string): void;
      destroySlots(slots: GoogletagSlot[]): void;
    };
  }
}
