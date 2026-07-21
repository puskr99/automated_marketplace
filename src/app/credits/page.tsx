import Link from "next/link";
import { auth, signIn } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { getBalances } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginAds } from "@/components/margin-ads";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSc, USD_TO_SC_RATE } from "@/lib/currency";
import { CreditActions } from "./credit-actions";

export const dynamic = "force-dynamic";

const TRANSACTION_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  AD_REWARD: "Watched an ad",
  JOB_SPEND: "Ran a worker",
  JOB_EARNING: "Worker run completed",
  JOB_REFUND: "Refund",
};

export default async function CreditsPage(
  props: PageProps<"/credits">,
) {
  const { deposit } = await props.searchParams;
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
          className="mt-6"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to view your balance.
          </p>
          <Button type="submit">Sign in with Google</Button>
        </form>
      </div>
    );
  }

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email: session.user!.email! } }),
    () => db.user.create({ data: { email: session.user!.email! } }),
  );

  const balances = await getBalances(user.id);
  const account = await db.creditAccount.findUniqueOrThrow({ where: { userId: user.id } });
  const transactions = await db.creditTransaction.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <MarginAds contentWidthPx={768} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <Link href="/credits/earn" className="text-sm underline">
          Earn free credits
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        1 USD = {USD_TO_SC_RATE} SC
      </p>

      {deposit === "success" && (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Deposit received — it can take a few seconds to appear below.
        </p>
      )}
      {deposit === "cancelled" && (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Deposit cancelled — no charge was made.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Withdrawable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">
              {formatSc(balances.withdrawableCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              From deposits and completed worker runs. Redeemable to USDC.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">
              {formatSc(balances.bonusCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              From watching ads. Spendable on worker runs only — not withdrawable.
            </p>
          </CardContent>
        </Card>
      </div>

      <CreditActions />

      <div className="mt-10">
        <h2 className="text-base font-medium">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{TRANSACTION_LABELS[tx.type] ?? tx.type}</TableCell>
                  <TableCell className="capitalize">
                    {tx.balance.toLowerCase()}
                  </TableCell>
                  <TableCell
                    className={
                      tx.amountCents >= 0 ? "text-green-600 dark:text-green-500" : undefined
                    }
                  >
                    {tx.amountCents >= 0 ? "+" : ""}
                    {formatSc(Math.abs(tx.amountCents))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.createdAt.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
