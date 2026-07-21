import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { auth, signIn } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { getBalances } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { BottomBannerAd } from "@/components/bottom-banner-ad";
import { MarginAds } from "@/components/margin-ads";
import { formatSc } from "@/lib/currency";
import { WatchAdButton } from "./watch-ad-button";

export const dynamic = "force-dynamic";

export default async function EarnCreditsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Earn credits</h1>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
          className="mt-6"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to earn credits by watching ads.
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

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <MarginAds contentWidthPx={768} />
      <div className="flex items-center gap-2">
        <Link
          href="/credits"
          aria-label="Back to credits"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Earn credits</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Watch a short ad to earn bonus credits. Bonus credits can be spent on
        any worker run, but — unlike deposited credits — can&apos;t be
        withdrawn as cash.
      </p>

      <div className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Please disable your ad blocker on this page — ads have to load and
          play for a reward to count.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-4 rounded-lg border p-6">
        <div>
          <p className="text-sm text-muted-foreground">Current bonus balance</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {formatSc(balances.bonusCents)}
          </p>
        </div>
        <WatchAdButton />
      </div>

      {/* Well clear of the "Watch an ad" button above — Google's placement
          policy prohibits ads close enough to a control to risk an
          accidental click. */}
      <div className="mt-8">
        <BottomBannerAd />
      </div>
    </div>
  );
}
