"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db, findOrCreate } from "@/lib/db";

export async function acceptDeveloperTerms() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("sign in required");
  }
  const email = session.user.email;

  const user = await findOrCreate(
    () => db.user.findUnique({ where: { email } }),
    () => db.user.create({ data: { email } }),
  );

  await findOrCreate(
    () => db.developerProfile.findUnique({ where: { userId: user.id } }),
    () => db.developerProfile.create({ data: { userId: user.id } }),
  );

  await db.developerProfile.update({
    where: { userId: user.id },
    data: { termsAcceptedAt: new Date() },
  });

  revalidatePath("/developer/workers/new");
}
