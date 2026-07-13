"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type PaymentMethod = "stripe" | "crypto_usdc";

export function RunForm({
  workerSlug,
  amountCents,
}: {
  workerSlug: string;
  amountCents: number;
}) {
  const [buyerEmail, setBuyerEmail] = useState("");
  const [input, setInput] = useState("{}");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("crypto_usdc");
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payWithUsdc() {
    const { centsToUsdcBaseUnits, sendUsdcFromInjectedWallet } = await import(
      "@/lib/crypto/client"
    );

    setStatus("Fetching deposit address…");
    const configRes = await fetch("/api/crypto/config");
    const config = await configRes.json();
    if (!configRes.ok) throw new Error(config.error ?? "crypto payments unavailable");

    setStatus("Confirm the USDC transfer in your wallet…");
    const txHash = await sendUsdcFromInjectedWallet(
      config.depositAddress,
      centsToUsdcBaseUnits(amountCents),
    );

    setStatus("Verifying deposit on-chain and starting the job…");
    return txHash;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    setStatus(null);

    try {
      const parsedInput = JSON.parse(input);

      const body: Record<string, unknown> = {
        buyerEmail,
        workerSlug,
        input: parsedInput,
        paymentMethod,
      };

      if (paymentMethod === "crypto_usdc") {
        body.depositTxHash = await payWithUsdc();
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setResult(JSON.stringify(data, null, 2));
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="buyerEmail">Your email</Label>
        <Input
          id="buyerEmail"
          type="email"
          required
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="input">Input JSON</Label>
        <Textarea
          id="input"
          rows={6}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Auto-generated forms from the worker&apos;s input schema are on the
          roadmap — for now, paste input matching the schema above.
        </p>
      </div>
      <div>
        <Label>Payment method</Label>
        <RadioGroup
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
          className="mt-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="crypto_usdc" id="pay-usdc" />
            <Label htmlFor="pay-usdc" className="font-normal">
              USDC on Base (connects your wallet)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="stripe" id="pay-card" disabled />
            <Label htmlFor="pay-card" className="font-normal text-muted-foreground">
              Card via Stripe (checkout UI not wired up yet)
            </Label>
          </div>
        </RadioGroup>
      </div>
      <Button type="submit" disabled={submitting || paymentMethod === "stripe"}>
        {submitting ? "Processing…" : "Run worker"}
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <pre className="rounded-md border bg-muted p-4 text-xs overflow-auto">
          {result}
        </pre>
      )}
    </form>
  );
}
