import { NextResponse } from "next/server";
import { chain, USDC_ADDRESS, getPlatformAddress } from "@/lib/crypto/server";

export async function GET() {
  const depositAddress = getPlatformAddress();
  if (!depositAddress) {
    return NextResponse.json(
      { error: "crypto payments not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    depositAddress,
    usdcAddress: USDC_ADDRESS,
    chainId: chain.id,
    chainName: chain.name,
  });
}
