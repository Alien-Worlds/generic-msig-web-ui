import { APIClient, Transaction, Serializer } from "@wharfkit/antelope";

export interface DecodedActionDetails {
  contract: string;
  name: string;
  data: Record<string, unknown>;
}

/**
 * Best-effort decoder for the packed_transaction field coming from msig.worlds.
 *
 * The exact on-chain format can vary; this helper first tries to parse JSON
 * (in case the node stores the transaction as JSON) and falls back to returning
 * an empty structure if decoding fails. It is intentionally defensive so the UI
 * can always render something even if the payload format changes.
 */
export async function decodePackedTransaction(
  client: APIClient,
  packed_transaction: string,
): Promise<DecodedActionDetails[]> {
  if (!packed_transaction) return [];

  // Heuristic 1: packed_transaction is already JSON with actions array.
  try {
    const parsed = JSON.parse(packed_transaction) as {
      actions?: Array<{
        account?: string;
        name?: string;
        data?: Record<string, unknown>;
      }>;
    };
    if (parsed && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      return parsed.actions.map((a) => ({
        contract: String(a.account ?? ""),
        name: String(a.name ?? ""),
        data:
          (a.data && typeof a.data === "object"
            ? (a.data as Record<string, unknown>)
            : {}) ?? {},
      }));
    }
  } catch {
    // Intentionally ignore and fall through to binary decoding below.
  }

  // Binary decoding path: packed_transaction is a hex-encoded Transaction.
  try {
    const tx = Serializer.decode({
      data: packed_transaction,
      type: Transaction,
    }) as Transaction;

    const actions = Array.isArray((tx as unknown as { actions?: unknown[] }).actions)
      ? ((tx as unknown as { actions: unknown[] }).actions as Array<{
          account: unknown;
          name: unknown;
          data?: unknown;
        }>)
      : [];

    const decoded: DecodedActionDetails[] = [];

    for (const action of actions) {
      const contract = String(action.account ?? "");
      const name = String(action.name ?? "");
      let dataObject: Record<string, unknown> = {};

      const dataHex = action.data != null ? String(action.data) : "";
      if (contract && name && dataHex) {
        try {
          const { abi } = await client.v1.chain.get_abi(contract);
          const decodedStruct = Serializer.decode({
            data: dataHex,
            abi,
            type: name,
          });
          dataObject = Serializer.objectify(
            decodedStruct,
          ) as Record<string, unknown>;
        } catch {
          // If ABI lookup or decode fails, fall back to exposing raw hex.
          dataObject = { raw: dataHex };
        }
      }

      decoded.push({
        contract,
        name,
        data: dataObject,
      });
    }

    return decoded;
  } catch {
    // Fall through – nothing decodable.
  }

  return [];
}

