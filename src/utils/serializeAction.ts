/**
 * Serialize an EOSIO action for use in msig.worlds propose.
 * Uses Wharfkit Action + ABI for encoding.
 */

import { Action, ABI } from "@wharfkit/antelope";
import type { ContractAbi } from "@/hooks/useContractAbi";
import type { ActionField } from "@/utils/abiForm";
import { getInputKind } from "@/utils/abiTypeMapping";
import type { SerializedAction } from "@/types/msig";

function coerceValue(value: unknown, field: ActionField): unknown {
  const str = value == null ? "" : String(value).trim();
  const kind = getInputKind(field.type);

  if (field.isArray) {
    if (str === "") return [];
    const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.map((p) => coerceValue(p, { ...field, isArray: false }));
  }

  if (kind === "number") {
    if (str === "") return 0;
    const n = Number(str);
    return Number.isNaN(n) ? 0 : n;
  }
  if (kind === "checkbox") {
    return value === true || value === "true" || value === "1" || str === "1";
  }
  if (kind === "date") {
    if (str === "") return "";
    return str;
  }

  return str;
}

/**
 * Build coerced action data from form values.
 */
export function coerceActionData(
  formValues: Record<string, unknown>,
  fields: ActionField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = formValues[f.name];
    out[f.name] = coerceValue(raw, f);
  }
  return out;
}

/**
 * Serialize an inner EOSIO action for msig.worlds propose.
 * Returns the format expected by BasicProposal.trx.actions.
 */
export function serializeActionForProposal(
  account: string,
  name: string,
  authorization: Array<{ actor: string; permission: string }>,
  data: Record<string, unknown>,
  contractAbi: ContractAbi
): SerializedAction {
  const abi = ABI.from(contractAbi as Parameters<typeof ABI.from>[0]);
  const untypedAction = {
    account,
    name,
    authorization,
    data,
  };
  const typedAction = Action.from(untypedAction, abi);

  return {
    account: typedAction.account.toString(),
    name: typedAction.name.toString(),
    authorization: typedAction.authorization.map((a) => ({
      actor: a.actor.toString(),
      permission: a.permission.toString(),
    })),
    data: typedAction.data.hexString,
  };
}
