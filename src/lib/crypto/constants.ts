import { parseAbi, type Address } from "viem";
import { base, baseSepolia } from "viem/chains";

// Defaults to testnet so a misconfigured deploy can't accidentally move real
// funds. Mainnet is opt-in via CRYPTO_NETWORK=mainnet.
const IS_MAINNET = process.env.CRYPTO_NETWORK === "mainnet";
export const chain = IS_MAINNET ? base : baseSepolia;

// Addresses confirmed against Circle's official docs
// (https://developers.circle.com/stablecoins/usdc-contract-addresses) — do
// not change without re-verifying there; a wrong address sends funds to an
// arbitrary contract with no way to recover them.
export const USDC_ADDRESS: Address = IS_MAINNET
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const USDC_DECIMALS = 6;

export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export function centsToUsdcBaseUnits(cents: number): bigint {
  return BigInt(cents) * BigInt(10_000); // 1 cent = 0.01 USDC = 10,000 base units (6 decimals)
}

// Truncates towards zero — a deposit isn't a whole number of cents in USDC
// base units, the dust is simply not credited (never rounds in the depositor's
// favor).
export function usdcBaseUnitsToCents(baseUnits: bigint): number {
  return Number(baseUnits / BigInt(10_000));
}
