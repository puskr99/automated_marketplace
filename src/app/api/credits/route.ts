import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";
import { getBalances } from "@/lib/credits";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
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
    take: 50,
  });

  return NextResponse.json({ ...balances, transactions });
}
