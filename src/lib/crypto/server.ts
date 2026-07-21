// No `server-only` guard here (unlike a typical Next.js server module):
// this file is intentionally imported by both Next.js API routes AND the
// standalone worker.ts process, which runs outside Next.js entirely and
// would crash on the `server-only` import. Never import this from a React
// Client Component regardless.
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  isAddressEqual,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, USDC_ADDRESS, erc20Abi } from "./constants";

export {
  chain,
  USDC_ADDRESS,
  USDC_DECIMALS,
  centsToUsdcBaseUnits,
  usdcBaseUnitsToCents,
} from "./constants";

export const publicClient = createPublicClient({ chain, transport: http() });

function getPlatformAccount() {
  const key = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!key) return null;
  return privateKeyToAccount(key as `0x${string}`);
}

// This is also the deposit address buyers send USDC to. Same MVP hot wallet
// for both sides for now — see README for the custody caveat before this
// handles real volume.
export function getPlatformAddress(): Address | null {
  return getPlatformAccount()?.address ?? null;
}

type VerifiedDeposit = {
  fromAddress: Address;
  amountBaseUnits: bigint;
};

// Verifies a buyer-submitted tx hash against the chain itself — never trust
// the amount/recipient the client claims. Throws on anything that doesn't
// conclusively show USDC arriving at the platform address.
export async function verifyUsdcDeposit(
  txHash: Hash,
  minAmountBaseUnits: bigint,
): Promise<VerifiedDeposit> {
  const platformAddress = getPlatformAddress();
  if (!platformAddress) {
    throw new Error("platform wallet not configured (PLATFORM_WALLET_PRIVATE_KEY)");
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("deposit transaction did not succeed on-chain");
  }

  const transferLogs = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
  }).filter(
    (log) =>
      isAddressEqual(log.address, USDC_ADDRESS) &&
      isAddressEqual(log.args.to, platformAddress),
  );

  if (transferLogs.length === 0) {
    throw new Error("transaction contains no USDC transfer to the platform address");
  }

  const totalReceived = transferLogs.reduce((sum, log) => sum + log.args.value, BigInt(0));
  if (totalReceived < minAmountBaseUnits) {
    throw new Error(
      `deposit amount too low: received ${totalReceived}, need ${minAmountBaseUnits}`,
    );
  }

  return { fromAddress: transferLogs[0].args.from, amountBaseUnits: totalReceived };
}

// Sends USDC from the platform wallet — used for both payout-on-success and
// refund-on-failure. Throws if the hot wallet isn't configured.
export async function sendUsdc(to: Address, amountBaseUnits: bigint): Promise<Hash> {
  const account = getPlatformAccount();
  if (!account) {
    throw new Error("platform wallet not configured (PLATFORM_WALLET_PRIVATE_KEY)");
  }

  const walletClient = createWalletClient({ account, chain, transport: http() });
  return walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountBaseUnits],
  });
}
