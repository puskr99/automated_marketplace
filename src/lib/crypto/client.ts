"use client";
import "client-only";
import { createWalletClient, custom, type Address, type Hash } from "viem";
import { chain, USDC_ADDRESS, erc20Abi } from "./constants";

export { chain, USDC_ADDRESS, USDC_DECIMALS, centsToUsdcBaseUnits } from "./constants";

declare global {
  interface Window {
    ethereum?: import("viem").EIP1193Provider;
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

// Connects the injected wallet (MetaMask, Coinbase Wallet, etc.), switches
// it to the configured chain, and sends a USDC transfer to `to`. Returns the
// broadcast tx hash — the caller still needs to submit that to the backend,
// which verifies the transfer on-chain before trusting it.
export async function sendUsdcFromInjectedWallet(
  to: Address,
  amountBaseUnits: bigint,
): Promise<Hash> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found (install MetaMask or Coinbase Wallet)");
  }

  const walletClient = createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });

  const [account] = await walletClient.requestAddresses();

  try {
    await walletClient.switchChain({ id: chain.id });
  } catch {
    await walletClient.addChain({ chain });
    await walletClient.switchChain({ id: chain.id });
  }

  return walletClient.writeContract({
    account,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountBaseUnits],
  });
}
