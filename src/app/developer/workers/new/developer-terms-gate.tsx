"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PLATFORM_MAX_FREE_RUNS } from "@/lib/manifest";

const CAN = [
  "Publish AI agents, APIs, scrapers, automation tools, or any other programmable service with a structured input/output.",
  "Set your own pricing (per call, per unit, or subscription) and offer free trial runs, up to the platform-wide cap.",
  "Choose an outcome policy (Friendly, Standard, or Strict) that defines your own retry and refund terms for failed runs.",
  "Get paid through escrow — funds release to you once a job completes successfully.",
];

const CANNOT = [
  "Submit a privacy declaration that doesn't match what your endpoint actually does. The documentation agent checks every submission for this.",
  "Expose credentials, leak user data, or ship prompt-injection or other security vulnerabilities. The security agent scans every submission and flags issues — it does not auto-ban, but repeated flags block approval.",
  "Expect automatic approval. Every worker goes through documentation, security, benchmark, and judge review before it can go live, and can be rejected.",
  "Skip refunds for outages you cause. The platform automatically refunds users if your endpoint is unavailable, times out, or returns an invalid response — regardless of your outcome policy.",
];

export function DeveloperTermsGate({
  onAccept,
}: {
  onAccept: () => Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border p-4">
        <h2 className="font-heading text-sm font-medium">You can</h2>
        <ul className="mt-3 space-y-2">
          {CAN.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-heading text-sm font-medium">You can&apos;t</h2>
        <ul className="mt-3 space-y-2">
          {CANNOT.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 size-4 shrink-0 text-destructive" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-heading text-sm font-medium">Privacy</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Your manifest must declare whether you log input, log output, retain
          data, and share data with third parties — accurately. Free trials
          are capped platform-wide at {PLATFORM_MAX_FREE_RUNS} runs regardless
          of what your manifest requests. Users and the verification pipeline
          rely on these declarations being true; a mismatch is treated as a
          documentation or security issue, not a bug we quietly fix for you.
        </p>
      </section>

      <div className="flex items-start gap-2">
        <Checkbox
          id="agree"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
        />
        <Label htmlFor="agree" className="font-normal text-muted-foreground">
          I have read and agree to the developer terms and privacy policy above.
        </Label>
      </div>

      <form
        action={async () => {
          setPending(true);
          try {
            await onAccept();
          } finally {
            setPending(false);
          }
        }}
      >
        <Button type="submit" disabled={!agreed || pending}>
          {pending ? "Continuing…" : "Continue to publish"}
        </Button>
      </form>
    </div>
  );
}
