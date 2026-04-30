import { Chains } from "@wharfkit/session";

/**
 * Known contract account names per chain.
 * Used for search suggestions in the Create Proposal modal.
 * Add chains and contracts as needed.
 */
export const KNOWN_CONTRACTS: Record<string, string[]> = {
  // WAX mainnet - Alien Worlds and common contracts
  [String(Chains.WAX.id)]: [
    "token.worlds",
    "mine.worlds",
    "farm.worlds",
    "battle.worlds",
    "staking.worlds",
    "stkvt.worlds",
    "ref.worlds",
    "index.worlds",
    "alien.worlds",
    "eosio.token",
    "eosio",
  ],
  // EOS mainnet
  [String(Chains.EOS.id)]: ["eosio.token", "eosio"],
  // Telos mainnet
  [String(Chains.Telos.id)]: ["eosio.token", "eosio"],
};

/**
 * Get curated contract names for a chain ID.
 * Falls back to WAX mainnet contracts if chain not in config.
 */
export function getKnownContractsForChain(chainId: string): string[] {
  return (
    KNOWN_CONTRACTS[chainId] ?? KNOWN_CONTRACTS[String(Chains.WAX.id)] ?? []
  );
}
