/**
 * MSIG API service - fetches proposals and approvals from msig.worlds on WAX.
 */

import { APIClient, FetchProvider } from "@wharfkit/antelope";
import { Chains } from "@wharfkit/session";
import type { Session } from "@wharfkit/session";
import { MSIG_CONTRACT, getDaoDisplayName } from "@/types/msig";

export const MSIG_SCOPES = [
  "naron",
  "naronunn",
  "eyeke",
  "eyekeunn",
  "magor",
  "magorunn",
  "kavian",
  "kavianunn",
  "nerix",
  "neriunn",
  "veles",
  "velesunn",
  "testa", // TEMP: testing planet
  "testaunn", // TEMP: testa union
] as const;

/** DAO dropdown options: { value: dac_id, label: display name } */
export const DAO_SCOPE_OPTIONS = MSIG_SCOPES.map((scope) => ({
  value: scope,
  label: getDaoDisplayName(scope),
}));

const TABLE_LIMIT = 1000;
const DAO_CONTRACT = "dao.worlds";
const DEFAULT_HIGH_THRESHOLD = 3;
const DEFAULT_TOP_CANDIDATE_LIMIT = 8;

export interface MetadataEntry {
  key: string;
  value: string;
}

export interface RawProposalRow {
  id: number;
  proposal_name: string;
  proposer: string;
  packed_transaction: string;
  earliest_exec_time: string;
  modified_date: string;
  state: number;
  metadata?: Array<MetadataEntry> | string;
}

export interface RawApprovalRow {
  proposal_name?: string;
  provided_approvals?: Array<{ actor: string; permission: string }>;
  requested_approvals?: Array<{ actor: string; permission: string }>;
  level?: { actor: string; permission: string };
}

export interface ApprovalInfo {
  count: number;
  threshold: number;
  hasCurrentUserApproved: boolean;
  providedActors: string[];
}

export interface ProposalWithScope extends RawProposalRow {
  dac_id: string;
}

interface RawCandidateRow {
  rank?: number | string;
  candidate_name?: string;
  candidate?: string;
  cand?: string;
  account?: string;
  actor?: string;
}

interface RawCustodianRow {
  cust_name?: string;
  custodian?: string;
  account?: string;
  actor?: string;
}

interface DacGlobalItem {
  key?: string;
  value?: unknown;
}

interface RawDacGlobalsRow {
  items?: DacGlobalItem[];
  data?: DacGlobalItem[];
  globals?: DacGlobalItem[];
}

export interface DaoGovernanceData {
  currentCustodians: string[];
  topCandidates: string[];
  highThreshold: number;
}

function getApiClient(session: Session | undefined): APIClient {
  const boundFetch = (...args: Parameters<typeof fetch>) => fetch(...args);
  if (session?.chain) {
    return new APIClient({
      provider: new FetchProvider(session.chain.url, { fetch: boundFetch }),
    });
  }
  return new APIClient({
    provider: new FetchProvider(Chains.WAX.url, { fetch: boundFetch }),
  });
}

export interface GetTableRowsOptions {
  limit?: number;
  index_position?: string | number;
  reverse?: boolean;
  key_type?: string;
  lower_bound?: string;
  upper_bound?: string;
}

async function getTableRows<T = unknown>(
  client: APIClient,
  code: string,
  table: string,
  scope: string,
  limit = TABLE_LIMIT,
  options: GetTableRowsOptions = {}
): Promise<T[]> {
  const { index_position, reverse, key_type, lower_bound, upper_bound } = options;
  const params: Record<string, unknown> = {
    json: true,
    code,
    table,
    scope,
    limit,
  };
  if (index_position != null) {
    params.index_position = index_position;
  }
  if (reverse === true) {
    params.reverse = true;
  }
  if (key_type != null) {
    params.key_type = key_type;
  }
  if (lower_bound != null) {
    params.lower_bound = lower_bound;
  }
  if (upper_bound != null) {
    params.upper_bound = upper_bound;
  }
  const result = await client.call({
    path: "/v1/chain/get_table_rows",
    params,
  });
  const resp = result as { rows?: T[]; more?: boolean };
  return resp.rows ?? [];
}

/** `msig.worlds` `approvals`: scope = dac_id, primary key `proposal_name`; may exceed one page. */
async function getApprovalRowsForScope(
  client: APIClient,
  scope: string
): Promise<RawApprovalRow[]> {
  const all: RawApprovalRow[] = [];
  let lowerBound: string | undefined;
  let more = true;
  while (more) {
    const params: Record<string, unknown> = {
      json: true,
      code: MSIG_CONTRACT,
      table: "approvals",
      scope,
      limit: TABLE_LIMIT,
    };
    if (lowerBound != null) {
      params.lower_bound = lowerBound;
    }
    const result = await client.call({
      path: "/v1/chain/get_table_rows",
      params,
    });
    const resp = result as {
      rows?: RawApprovalRow[];
      more?: boolean;
      next_key?: string | number;
    };
    const rows = resp.rows ?? [];
    all.push(...rows);
    more = Boolean(resp.more) && rows.length > 0;
    if (!more) break;
    const nextKey = resp.next_key;
    if (nextKey === undefined || nextKey === null) break;
    lowerBound =
      typeof nextKey === "string" || typeof nextKey === "number"
        ? String(nextKey)
        : JSON.stringify(nextKey);
  }
  return all;
}

/**
 * Normalize metadata to array format (handles JSON string from some nodes).
 */
function normalizeMetadata(
  metadata: Array<MetadataEntry> | string | undefined
): MetadataEntry[] {
  if (!metadata) return [];
  if (Array.isArray(metadata)) return metadata;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Extract title from metadata array.
 */
function getTitleFromMetadata(
  metadata: Array<MetadataEntry> | string | undefined
): string {
  const arr = normalizeMetadata(metadata);
  const title = arr.find((m) => m.key === "title");
  return title?.value ?? "";
}

function pickActorName(row: Record<string, unknown>): string | null {
  const keys = [
    "candidate_name",
    "candidate",
    "cand",
    "cust_name",
    "custodian",
    "account",
    "actor",
    "owner",
  ] as const;
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

function normalizeRank(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractHighThreshold(items: DacGlobalItem[]): number {
  for (const item of items) {
    if (item?.key !== "auth_threshold_high") continue;
    const raw = item.value;
    if (Array.isArray(raw) && raw.length >= 2) {
      const parsed = Number(raw[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    if (typeof raw === "number" && raw > 0) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    if (raw && typeof raw === "object" && "value" in (raw as Record<string, unknown>)) {
      const parsed = Number((raw as { value?: unknown }).value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return DEFAULT_HIGH_THRESHOLD;
}

function dedupeActors(actors: string[]): string[] {
  return Array.from(new Set(actors.filter((actor) => actor.trim() !== "")));
}

/**
 * msig.worlds uses `{ level: { actor, permission }, time }` per entry; eosio.msig uses flat `{ actor, permission }`.
 */
function actorFromApprovalEntry(entry: unknown): string | null {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const t = entry.trim();
    return t || null;
  }
  if (typeof entry !== "object") return null;
  const o = entry as Record<string, unknown>;
  if (typeof o.actor === "string" && o.actor.trim()) {
    return o.actor.trim();
  }
  const nested = o.level;
  if (nested && typeof nested === "object" && nested !== null) {
    const a = (nested as { actor?: unknown }).actor;
    if (typeof a === "string" && a.trim()) {
      return a.trim();
    }
  }
  return null;
}

/**
 * Parse approval row - handles both eosio.msig style (provided_approvals, requested_approvals)
 * and msig.worlds nested `level` entries.
 */
function parseApprovalRow(
  row: RawApprovalRow,
  _proposalName: string,
  currentUser: string | null
): {
  count: number;
  threshold: number;
  hasApproved: boolean;
  providedActors: string[];
} {
  let count = 0;
  let threshold = 3;
  const actors: string[] = [];
  const providedActors: string[] = [];

  if (row.provided_approvals && Array.isArray(row.provided_approvals)) {
    for (const entry of row.provided_approvals) {
      const actor = actorFromApprovalEntry(entry);
      if (!actor) continue;
      count++;
      actors.push(actor);
      providedActors.push(actor);
    }
  }
  if (row.requested_approvals && Array.isArray(row.requested_approvals)) {
    threshold = count + row.requested_approvals.length;
  } else {
    threshold = Math.max(threshold, count);
  }
  if (
    count === 0 &&
    row.level &&
    typeof row.level === "object"
  ) {
    const actor = actorFromApprovalEntry(row.level);
    if (actor) {
      count = 1;
      actors.push(actor);
      providedActors.push(actor);
      threshold = Math.max(threshold, 1);
    }
  }

  const hasApproved =
    currentUser != null && actors.some((a) => a === currentUser);

  return {
    count,
    threshold,
    hasApproved,
    providedActors: dedupeActors(providedActors),
  };
}

/**
 * Build approvals map from approvals table rows.
 * Scope = dac_id (per-chain scope); primary key proposal_name.
 * Rows use msig.worlds shape: `provided_approvals` / `requested_approvals` entries with nested `level.actor`.
 */
function buildApprovalsMap(
  approvalRowsByScope: Map<string, RawApprovalRow[]>,
  currentUser: string | null
): Map<string, ApprovalInfo> {
  const map = new Map<string, ApprovalInfo>();
  for (const [dacId, rows] of approvalRowsByScope) {
    for (const row of rows) {
      const proposalName = row.proposal_name ?? (row as Record<string, unknown>).proposal_name as string | undefined;
      if (!proposalName) continue;
      const key = `${dacId}::${proposalName}`;
      const { count, threshold, hasApproved, providedActors } = parseApprovalRow(
        row,
        proposalName,
        currentUser
      );
      map.set(key, {
        count,
        threshold,
        hasCurrentUserApproved: hasApproved,
        providedActors,
      });
    }
  }
  return map;
}

async function fetchCandidatesByRank(
  client: APIClient,
  scope: string
): Promise<string[]> {
  const rows = await getTableRows<RawCandidateRow>(
    client,
    DAO_CONTRACT,
    "candidates",
    scope,
    TABLE_LIMIT,
    { index_position: "secondary", key_type: "i64" }
  );
  const ranked = rows
    .map((row) => {
      const actor = pickActorName(row as unknown as Record<string, unknown>);
      const rank = normalizeRank((row as { rank?: unknown }).rank);
      return actor && rank != null ? { actor, rank } : null;
    })
    .filter((entry): entry is { actor: string; rank: number } => entry != null)
    .sort((a, b) => a.rank - b.rank);
  return dedupeActors(ranked.map((entry) => entry.actor));
}

async function fetchCurrentCustodians(
  client: APIClient,
  scope: string
): Promise<string[]> {
  const tableCandidates = ["custodians1", "custodians", "custodian"];
  for (const table of tableCandidates) {
    try {
      const rows = await getTableRows<RawCustodianRow>(
        client,
        DAO_CONTRACT,
        table,
        scope,
        TABLE_LIMIT
      );
      const custodians = dedupeActors(
        rows
          .map((row) => pickActorName(row as unknown as Record<string, unknown>))
          .filter((name): name is string => name != null)
      );
      if (custodians.length > 0) {
        return custodians;
      }
    } catch {
      // Try next table candidate.
    }
  }
  return [];
}

async function fetchHighThreshold(
  client: APIClient,
  scope: string
): Promise<number> {
  const rows = await getTableRows<RawDacGlobalsRow | DacGlobalItem[]>(
    client,
    DAO_CONTRACT,
    "dacglobals",
    scope,
    TABLE_LIMIT
  );
  const items: DacGlobalItem[] = [];
  for (const row of rows) {
    if (Array.isArray(row)) {
      items.push(...row);
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const obj = row as RawDacGlobalsRow;
    if (Array.isArray(obj.items)) items.push(...obj.items);
    if (Array.isArray(obj.data)) items.push(...obj.data);
    if (Array.isArray(obj.globals)) items.push(...obj.globals);
  }
  return extractHighThreshold(items);
}

export async function fetchDaoGovernanceData(
  session: Session | undefined,
  scope: string
): Promise<DaoGovernanceData> {
  const client = getApiClient(session);
  const [currentCustodians, topCandidates, highThreshold] = await Promise.all([
    fetchCurrentCustodians(client, scope),
    fetchCandidatesByRank(client, scope),
    fetchHighThreshold(client, scope),
  ]);
  return {
    currentCustodians,
    topCandidates,
    highThreshold,
  };
}

export async function fetchRequestedApproversByRank(
  session: Session | undefined,
  scope: string,
  proposer: string,
  limit = DEFAULT_TOP_CANDIDATE_LIMIT
): Promise<Array<{ actor: string; permission: "active" }>> {
  const governance = await fetchDaoGovernanceData(session, scope);
  const picked = governance.topCandidates.slice(0, Math.max(1, limit));
  const requestedActors = dedupeActors([...picked, proposer]);
  return requestedActors.map((actor) => ({ actor, permission: "active" as const }));
}

/**
 * Fetch all proposals from all MSIG scopes.
 */
export async function fetchProposals(
  session: Session | undefined
): Promise<ProposalWithScope[]> {
  const client = getApiClient(session);
  const results = await Promise.all(
    MSIG_SCOPES.map(async (scope) => {
      const rows = await getTableRows<RawProposalRow>(
        client,
        MSIG_CONTRACT,
        "proposals",
        scope,
        TABLE_LIMIT,
        { index_position: "secondary", reverse: true, key_type: "i64" }
      );
      return rows.map((r) => ({ ...r, dac_id: scope }));
    })
  );
  const flat = results.flat();
  flat.sort((a, b) => {
    const da = a.modified_date || "";
    const db = b.modified_date || "";
    return db.localeCompare(da);
  });
  return flat;
}

/**
 * Fetch all approvals from all MSIG scopes.
 */
export async function fetchApprovals(
  session: Session | undefined
): Promise<Map<string, RawApprovalRow[]>> {
  const client = getApiClient(session);
  const results = await Promise.all(
    MSIG_SCOPES.map(async (scope) => {
      const rows = await getApprovalRowsForScope(client, scope);
      return { scope, rows };
    })
  );
  const map = new Map<string, RawApprovalRow[]>();
  for (const { scope, rows } of results) {
    map.set(scope, rows);
  }
  return map;
}

/**
 * Fetch proposals and approvals, merge into unified data.
 */
export async function fetchMsigData(session: Session | undefined): Promise<{
  proposals: ProposalWithScope[];
  approvalsMap: Map<string, ApprovalInfo>;
  getTitle: (p: ProposalWithScope) => string;
}> {
  const currentUser = session ? session.actor.toString() : null;
  const [proposals, approvalRowsByScope] = await Promise.all([
    fetchProposals(session),
    fetchApprovals(session),
  ]);
  const approvalsMap = buildApprovalsMap(approvalRowsByScope, currentUser);
  const getTitle = (p: ProposalWithScope) =>
    getTitleFromMetadata(p.metadata) || p.proposal_name;
  return { proposals, approvalsMap, getTitle };
}

/**
 * Fetch proposals and approvals for a single scope (DAO).
 */
export async function fetchMsigDataForScope(
  session: Session | undefined,
  scope: string
): Promise<{
  proposals: ProposalWithScope[];
  approvalsMap: Map<string, ApprovalInfo>;
  getTitle: (p: ProposalWithScope) => string;
  governance: DaoGovernanceData;
  governanceWarning: string | null;
}> {
  const client = getApiClient(session);
  const currentUser = session ? session.actor.toString() : null;

  const [proposalRows, approvalRows, governanceResult] = await Promise.all([
    getTableRows<RawProposalRow>(
      client,
      MSIG_CONTRACT,
      "proposals",
      scope,
      TABLE_LIMIT,
      { index_position: "secondary", reverse: true, key_type: "i64" }
    ),
    getApprovalRowsForScope(client, scope),
    fetchDaoGovernanceData(session, scope)
      .then((governance) => ({ governance, warning: null as string | null }))
      .catch((err: unknown) => ({
        governance: {
          currentCustodians: [],
          topCandidates: [],
          highThreshold: DEFAULT_HIGH_THRESHOLD,
        },
        warning:
          err instanceof Error
            ? err.message
            : "Failed to load DAO governance data",
      })),
  ]);

  const proposals: ProposalWithScope[] = proposalRows
    .map((r) => ({ ...r, dac_id: scope }))
    .sort((a, b) => {
      const da = a.modified_date || "";
      const db = b.modified_date || "";
      return db.localeCompare(da);
    });

  const approvalRowsByScope = new Map<string, RawApprovalRow[]>();
  approvalRowsByScope.set(scope, approvalRows);
  const approvalsMap = buildApprovalsMap(approvalRowsByScope, currentUser);
  const getTitle = (p: ProposalWithScope) =>
    getTitleFromMetadata(p.metadata) || p.proposal_name;

  return {
    proposals,
    approvalsMap,
    getTitle,
    governance: governanceResult.governance,
    governanceWarning: governanceResult.warning,
  };
}

/**
 * Fetch proposals for a single scope (DAO) filtered by proposer.
 * Uses secondary index on proposer when available; falls back to client-side filtering.
 */
export async function fetchMsigDataForScopeByProposer(
  session: Session | undefined,
  scope: string,
  proposer: string
): Promise<{
  proposals: ProposalWithScope[];
  approvalsMap: Map<string, ApprovalInfo>;
  getTitle: (p: ProposalWithScope) => string;
  governance: DaoGovernanceData;
  governanceWarning: string | null;
}> {
  const client = getApiClient(session);
  const currentUser = session ? session.actor.toString() : null;

  // Try proposer secondary index (index_position 2 = first secondary; proposer is often the secondary index)
  let proposalRows: RawProposalRow[];
  try {
    proposalRows = await getTableRows<RawProposalRow>(
      client,
      MSIG_CONTRACT,
      "proposals",
      scope,
      TABLE_LIMIT,
      {
        index_position: 2,
        key_type: "name",
        lower_bound: proposer,
        upper_bound: proposer,
      }
    );
  } catch {
    // Fallback: fetch all and filter client-side
    const all = await getTableRows<RawProposalRow>(
      client,
      MSIG_CONTRACT,
      "proposals",
      scope,
      TABLE_LIMIT,
      { index_position: "secondary", reverse: true, key_type: "i64" }
    );
    proposalRows = all.filter((r) => r.proposer === proposer);
  }

  const [approvalRows, governanceResult] = await Promise.all([
    getApprovalRowsForScope(client, scope),
    fetchDaoGovernanceData(session, scope)
      .then((governance) => ({ governance, warning: null as string | null }))
      .catch((err: unknown) => ({
        governance: {
          currentCustodians: [],
          topCandidates: [],
          highThreshold: DEFAULT_HIGH_THRESHOLD,
        },
        warning:
          err instanceof Error
            ? err.message
            : "Failed to load DAO governance data",
      })),
  ]);

  const proposals: ProposalWithScope[] = proposalRows
    .map((r) => ({ ...r, dac_id: scope }))
    .sort((a, b) => {
      const da = a.modified_date || "";
      const db = b.modified_date || "";
      return db.localeCompare(da);
    });

  const approvalRowsByScope = new Map<string, RawApprovalRow[]>();
  approvalRowsByScope.set(scope, approvalRows);
  const approvalsMap = buildApprovalsMap(approvalRowsByScope, currentUser);
  const getTitle = (p: ProposalWithScope) =>
    getTitleFromMetadata(p.metadata) || p.proposal_name;

  return {
    proposals,
    approvalsMap,
    getTitle,
    governance: governanceResult.governance,
    governanceWarning: governanceResult.warning,
  };
}
