/**
 * Hook to fetch MSIG proposals and approvals from msig.worlds.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Session } from "@wharfkit/session";
import { Serializer, Transaction } from "@wharfkit/antelope";
import {
  fetchMsigDataForScope,
  fetchMsigDataForScopeByProposer,
  type ProposalWithScope,
  type ApprovalInfo,
  type DaoGovernanceData,
} from "@/services/msigApi";
import { getDaoDisplayName, type ProposalStatus } from "@/types/msig";

export interface Proposal {
  id: number;
  /** msig.worlds row `state`: 0 = open, 1 = executed, 2 = cancelled */
  state: number;
  title: string;
  description: string;
  memo: string | null;
  createdBy: string;
  expireDate: string;
  dao: string;
  approvals: string;
  /** Account names with on-chain `provided_approvals` for this proposal. */
  approvalAccountIds: string[];
  status: ProposalStatus;
  proposal_name: string;
  dac_id: string;
  hasApproved: boolean;
  packed_transaction: string;
}

const DEFAULT_THRESHOLD = 3;
const INITIAL_DELAY_MS = 1500; // Wait for session/chain to stabilize after login
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;
let debugStatusLogCount = 0;

const sendDebugLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) => {
  // #region agent log
  fetch("http://127.0.0.1:7671/ingest/16444fb3-b2b9-4384-a7f2-6ce77f29e16a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "387f78",
    },
    body: JSON.stringify({
      sessionId: "387f78",
      runId: "pre-fix-proposal-expired",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
};

function parseUtcTimeMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function getPackedTransactionExpiration(packedTransaction: string): string | null {
  if (!packedTransaction) return null;
  try {
    const parsed = JSON.parse(packedTransaction) as { expiration?: unknown };
    if (typeof parsed?.expiration === "string" && parsed.expiration.trim()) {
      return parsed.expiration;
    }
  } catch {
    // Ignore JSON parse errors and continue to binary decode.
  }
  try {
    const tx = Serializer.decode({
      data: packedTransaction,
      type: Transaction,
    });
    const txObj = Serializer.objectify(tx) as { expiration?: unknown };
    if (typeof txObj?.expiration === "string" && txObj.expiration.trim()) {
      return txObj.expiration;
    }
  } catch {
    // Ignore decoding errors.
  }
  return null;
}

function formatExpireDate(expiration: string | null): string {
  if (!expiration) return "-";
  try {
    const normalized = expiration.endsWith("Z") ? expiration : `${expiration}Z`;
    const date = new Date(normalized);
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return expiration;
  }
}

function getApprovalKey(dacId: string, proposalName: string): string {
  return `${dacId}::${proposalName}`;
}

function mapStateToStatus(
  state: number,
  approvalCount: number,
  threshold: number,
  proposalExpiration: string | null
): ProposalStatus {
  const now = Date.now();
  const expirationMs = parseUtcTimeMs(proposalExpiration);
  const canUseExpiration = Number.isFinite(expirationMs);
  if (debugStatusLogCount < 25) {
    sendDebugLog(
      "H2_H3_H4_H5",
      "useMsigProposals.ts:mapStateToStatus",
      "Computing proposal status",
      {
        state,
        approvalCount,
        threshold,
        proposalExpiration,
        expirationMs: canUseExpiration ? expirationMs : null,
        nowMs: now,
        nowIso: new Date(now).toISOString(),
      },
    );
    debugStatusLogCount += 1;
  }

  if (state === 1) return "executed";
  if (state === 2) return "cancelled";
  if (state === 0) {
    if (canUseExpiration && expirationMs < now) {
      return "expired";
    }
    if (approvalCount >= threshold) return "approved";
    return "pending";
  }
  return "pending";
}

function mapToProposal(
  p: ProposalWithScope,
  getTitle: (p: ProposalWithScope) => string,
  approvalsMap: Map<string, ApprovalInfo>,
  governance: DaoGovernanceData
): Proposal {
  const metadataArr =
    typeof p.metadata === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(p.metadata) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : Array.isArray(p.metadata)
      ? p.metadata
      : [];
  const findMeta = (key: string) =>
    metadataArr.find((m) => m && m.key === key)?.value ?? "";
  const description = findMeta("description");
  const memo = findMeta("memo") || null;
  const key = getApprovalKey(p.dac_id, p.proposal_name);
  const approval = approvalsMap.get(key);
  const count = approval?.count ?? approval?.providedActors.length ?? 0;
  const threshold =
    governance.highThreshold > 0
      ? governance.highThreshold
      : (approval?.threshold ?? DEFAULT_THRESHOLD);
  const hasApproved = approval?.hasCurrentUserApproved ?? false;
  const proposalExpiration = getPackedTransactionExpiration(p.packed_transaction);
  const status = mapStateToStatus(
    p.state,
    count,
    threshold,
    proposalExpiration
  );
  if (debugStatusLogCount < 25) {
    sendDebugLog(
      "H2_H5",
      "useMsigProposals.ts:mapToProposal",
      "Mapped raw proposal row to UI model",
      {
        proposalName: p.proposal_name,
        dacId: p.dac_id,
        proposer: p.proposer,
        rawState: p.state,
        proposalExpiration,
        earliestExecTime: p.earliest_exec_time,
        modifiedDate: p.modified_date,
        approvalsCount: count,
        approvalsThreshold: threshold,
        highThreshold: governance.highThreshold,
        currentCustodianCount: governance.currentCustodians.length,
        mappedStatus: status,
      },
    );
    debugStatusLogCount += 1;
  }
  return {
    id: p.id,
    state: p.state,
    title: getTitle(p),
    description,
    memo,
    createdBy: p.proposer,
    expireDate: formatExpireDate(proposalExpiration),
    dao: getDaoDisplayName(p.dac_id),
    approvals: `${count}/${threshold}`,
    approvalAccountIds: approval?.providedActors ?? [],
    status,
    proposal_name: p.proposal_name,
    dac_id: p.dac_id,
    hasApproved,
    packed_transaction: p.packed_transaction,
  };
}

export function useMsigProposals(
  session: Session | undefined,
  selectedDacId: string | null,
  proposerFilter: string | null = null
) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [currentCustodians, setCurrentCustodians] = useState<string[]>([]);
  const [highThreshold, setHighThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const isInitialFetch = useRef(true);

  const refetch = useCallback(async () => {
    if (!session || !selectedDacId) {
      setProposals([]);
      setLoading(false);
      setError(null);
      setGovernanceError(null);
      setCurrentCustodians([]);
      setHighThreshold(DEFAULT_THRESHOLD);
      return;
    }
    setLoading(true);
    setError(null);
    setGovernanceError(null);
    let lastError: unknown;
    try {
      if (isInitialFetch.current) {
        isInitialFetch.current = false;
        await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS));
      }
      for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
        try {
          const fetchFn = proposerFilter
            ? () => fetchMsigDataForScopeByProposer(session, selectedDacId, proposerFilter)
            : () => fetchMsigDataForScope(session, selectedDacId);
          const {
            proposals: raw,
            approvalsMap,
            getTitle,
            governance,
            governanceWarning,
          } = await fetchFn();
          const mapped = raw.map((p) =>
            mapToProposal(p, getTitle, approvalsMap, governance),
          );
          setCurrentCustodians(governance.currentCustodians);
          setHighThreshold(governance.highThreshold || DEFAULT_THRESHOLD);
          setGovernanceError(governanceWarning);
          setProposals(mapped);
          return;
        } catch (err) {
          lastError = err;
          if (attempt < RETRY_COUNT) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
      const msg =
        lastError instanceof Error
          ? lastError.message
          : "Failed to fetch proposals";
      setError(msg);
      setProposals([]);
      setCurrentCustodians([]);
      setHighThreshold(DEFAULT_THRESHOLD);
    } finally {
      setLoading(false);
    }
  }, [session, selectedDacId, proposerFilter]);

  useEffect(() => {
    if (!selectedDacId) {
      setProposals([]);
      setLoading(false);
      setError(null);
      setGovernanceError(null);
      setCurrentCustodians([]);
      setHighThreshold(DEFAULT_THRESHOLD);
      isInitialFetch.current = true;
      return;
    }
    refetch();
  }, [refetch, selectedDacId]);

  return {
    proposals,
    loading,
    error,
    governanceError,
    currentCustodians,
    highThreshold,
    refetch,
  };
}
