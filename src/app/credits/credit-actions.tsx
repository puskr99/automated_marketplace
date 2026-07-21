"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/lib/feature-flags";
import { USD_TO_SC_RATE } from "@/lib/currency";

// Deposit/withdraw forms take an SC amount (the site's only user-facing
// unit) and convert to cents here, at the edge, since the backend routes
// and ledger (lib/credits.ts) are still cents-denominated internally.
function scToCents(value: string): number | null {
  const sc = Number(value);
  if (!Number.isFinite(sc) || sc <= 0) return null;
  return Math.round((sc / USD_TO_SC_RATE) * 100);
}

export function CreditActions() {
  const router = useRouter();

  const [depositAmount, setDepositAmount] = useState(String(10 * USD_TO_SC_RATE));
  const [depositBusy, setDepositBusy] = useState<"crypto" | "stripe" | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  async function depositWithCrypto() {
    const amountCents = scToCents(depositAmount);
    if (!amountCents) {
      setDepositError("enter a valid amount");
      return;
    }
    setDepositBusy("crypto");
    setDepositError(null);
    try {
      const { centsToUsdcBaseUnits, sendUsdcFromInjectedWallet } = await import(
        "@/lib/crypto/client"
      );
      const configRes = await fetch("/api/crypto/config");
      const config = await configRes.json();
      if (!configRes.ok) throw new Error(config.error ?? "crypto deposits unavailable");

      const depositTxHash = await sendUsdcFromInjectedWallet(
        config.depositAddress,
        centsToUsdcBaseUnits(amountCents),
      );

      const res = await fetch("/api/credits/deposit/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositTxHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "deposit failed");

      router.refresh();
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setDepositBusy(null);
    }
  }

  async function depositWithStripe() {
    const amountCents = scToCents(depositAmount);
    if (!amountCents) {
      setDepositError("enter a valid amount");
      return;
    }
    setDepositBusy("stripe");
    setDepositError(null);
    try {
      const res = await fetch("/api/credits/deposit/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "deposit failed");
      window.location.href = data.url;
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "something went wrong");
      setDepositBusy(null);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = scToCents(withdrawAmount);
    if (!amountCents) {
      setWithdrawError("enter a valid amount");
      return;
    }
    setWithdrawBusy(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    try {
      const res = await fetch("/api/credits/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, payoutAddress: withdrawAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "withdrawal failed");
      setWithdrawSuccess(`Sent — tx ${data.payoutTxHash}`);
      setWithdrawAmount("");
      router.refresh();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setWithdrawBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Deposit</CardTitle>
          {!REAL_MONEY_PAYMENTS_ENABLED && <Badge variant="secondary">Coming soon</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          {REAL_MONEY_PAYMENTS_ENABLED ? (
            <>
              <div>
                <Label htmlFor="deposit-amount">Amount (SC)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="200"
                  step="2"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={depositBusy !== null}
                  onClick={depositWithCrypto}
                >
                  {depositBusy === "crypto" && <Loader2 className="size-4 animate-spin" />}
                  Pay with USDC
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={depositBusy !== null}
                  onClick={depositWithStripe}
                >
                  {depositBusy === "stripe" && <Loader2 className="size-4 animate-spin" />}
                  Pay with card
                </Button>
              </div>
              {depositError && <p className="text-sm text-destructive">{depositError}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Card and USDC deposits aren&apos;t open yet. For now, the only way
                to fund your account is by watching ads.
              </p>
              <Button render={<Link href="/credits/earn" />} className="w-full">
                Earn credits by watching ads
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Withdraw</CardTitle>
          {!REAL_MONEY_PAYMENTS_ENABLED && <Badge variant="secondary">Coming soon</Badge>}
        </CardHeader>
        <CardContent>
          {REAL_MONEY_PAYMENTS_ENABLED ? (
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <Label htmlFor="withdraw-amount">Amount (SC)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  min="200"
                  step="2"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="withdraw-address">Payout address (USDC)</Label>
                <Input
                  id="withdraw-address"
                  placeholder="0x…"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={withdrawBusy} className="w-full">
                {withdrawBusy && <Loader2 className="size-4 animate-spin" />}
                Withdraw
              </Button>
              {withdrawError && <p className="text-sm text-destructive">{withdrawError}</p>}
              {withdrawSuccess && (
                <p className="break-all text-sm text-green-600 dark:text-green-500">
                  {withdrawSuccess}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Withdrawals aren&apos;t open yet — check back once real-money
              payments launch.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
