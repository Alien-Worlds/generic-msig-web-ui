const HYPERION_BASE_URLS = [
  "https://wax.eosphere.io",
  "https://wax.eosrio.io",
  "https://api.waxsweden.org",
] as const;
const EXEC_ACTION_FILTER = "msig.worlds:exec";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 60;

interface HyperionExecActionData {
  dac_id?: unknown;
  proposal_name?: unknown;
  executer?: unknown;
}

interface HyperionActionRecord {
  trx_id?: unknown;
  transaction_id?: unknown;
  act?: {
    data?: HyperionExecActionData;
  };
}

interface HyperionGetActionsResponse {
  actions?: HyperionActionRecord[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildGetActionsUrl(params: {
  baseUrl: string;
  limit?: number;
  skip?: number;
}): string {
  const search = new URLSearchParams({
    account: "msig.worlds",
    filter: EXEC_ACTION_FILTER,
    sort: "desc",
    limit: String(params.limit ?? 50),
    skip: String(params.skip ?? 0),
  });
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  return `${baseUrl}/v2/history/get_actions?${search.toString()}`;
}

export async function fetchExecutedProposalTxId(params: {
  dacId: string;
  proposalName: string;
  executer?: string;
}): Promise<string | null> {
  const targetExecuter = params.executer?.trim() || null;
  const maxPages = DEFAULT_MAX_PAGES;
  const pageSize = DEFAULT_PAGE_SIZE;

  for (const baseUrl of HYPERION_BASE_URLS) {
    for (let page = 0; page < maxPages; page += 1) {
      const url = buildGetActionsUrl({
        baseUrl,
        limit: pageSize,
        skip: page * pageSize,
      });

      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        break;
      }
      if (!response.ok) {
        break;
      }

      const payload = (await response.json()) as HyperionGetActionsResponse;
      const actions = Array.isArray(payload.actions) ? payload.actions : [];
      if (actions.length === 0) {
        break;
      }

      let fallbackTxId: string | null = null;
      for (const action of actions) {
        const txId = asString(action.trx_id) ?? asString(action.transaction_id);
        const actionData = action.act?.data;
        const actionDacId = asString(actionData?.dac_id);
        const actionProposalName = asString(actionData?.proposal_name);
        const actionExecuter = asString(actionData?.executer);

        if (!txId) continue;
        if (
          actionDacId !== params.dacId ||
          actionProposalName !== params.proposalName
        ) {
          continue;
        }
        if (!fallbackTxId) {
          fallbackTxId = txId;
        }
        if (!targetExecuter || actionExecuter === targetExecuter) {
          return txId;
        }
      }

      if (fallbackTxId) {
        return fallbackTxId;
      }
      if (actions.length < pageSize) {
        break;
      }
    }
  }

  return null;
}
