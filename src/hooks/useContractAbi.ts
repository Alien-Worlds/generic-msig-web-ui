import type { APIClient } from "@wharfkit/antelope";

/** Raw ABI as returned by get_abi (abi field). */
export type ContractAbi = Record<string, unknown> | null;

/**
 * Fetches the full contract ABI from the chain.
 * @returns The ABI object or null if none
 * @throws On network/API errors (account not found, etc.)
 */
export async function fetchContractAbi(
  client: APIClient,
  accountName: string
): Promise<ContractAbi> {
  const res = await client.v1.chain.get_abi(accountName);
  return (res.abi ?? null) as ContractAbi;
}

/**
 * Extracts action names from a full ABI object.
 */
export function getActionNamesFromAbi(abi: ContractAbi): string[] {
  if (!abi) return [];
  const actions = (abi as { actions?: Array<{ name?: unknown }> }).actions;
  if (!Array.isArray(actions) || actions.length === 0) return [];
  return actions.map((a) => {
    const name = a.name;
    if (typeof name === "string") return name;
    if (name != null && typeof (name as { toString?: () => string }).toString === "function") {
      return (name as { toString: () => string }).toString();
    }
    return String(name);
  });
}

/**
 * Fetches the contract ABI from the chain and extracts action names.
 * @param client - APIClient (from session.client)
 * @param accountName - Contract account name
 * @returns Array of action names, or empty array if no ABI/actions
 * @throws On network/API errors (account not found, etc.)
 */
export async function fetchContractActions(
  client: APIClient,
  accountName: string
): Promise<string[]> {
  const abi = await fetchContractAbi(client, accountName);
  if (!abi) return [];

  const actions = (abi as { actions?: Array<{ name?: unknown }> }).actions;
  if (!Array.isArray(actions) || actions.length === 0) return [];

  return actions.map((a) => {
    const name = a.name;
    if (typeof name === "string") return name;
    if (name != null && typeof (name as { toString?: () => string }).toString === "function") {
      return (name as { toString: () => string }).toString();
    }
    return String(name);
  });
}
