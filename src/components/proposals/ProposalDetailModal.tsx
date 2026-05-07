import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Session } from "@wharfkit/session";
import { Chains } from "@wharfkit/session";
import { APIClient, FetchProvider } from "@wharfkit/antelope";
import type { Proposal } from "@/hooks/useMsigProposals";
import { MSIG_CONTRACT, type ProposalStatus } from "@/types/msig";
import {
  decodePackedTransaction,
  type DecodedActionDetails,
} from "@/utils/decodePackedTransaction";
import { fetchExecutedProposalTxId } from "@/services/hyperionApi";

interface ProposalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal | null;
  session: Session;
  planetImagesLandscape: Record<string, string>;
  planetIcons: Record<string, string>;
  canCurrentUserApprove: boolean;
  highThreshold: number;
  onApprove: (p: Proposal) => Promise<void>;
  onExecute: (p: Proposal) => Promise<void>;
  onCancel: (p: Proposal) => Promise<void>;
  onCleanup: (p: Proposal) => Promise<void>;
}

function statusLabel(status: ProposalStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "executed":
      return "Executed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusColor(status: ProposalStatus): string {
  switch (status) {
    case "pending":
      return "#00BAFF";
    case "approved":
      return "#D9A555";
    case "executed":
      return "#0ED4A8";
    case "expired":
      return "#FF3B52";
    case "cancelled":
      return "#777777";
    default:
      return "#B9B9B9";
  }
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

function getPlanetKeyFromDaoLabel(dao: string): string {
  const key = dao.split(/\s+/)[0]?.toLowerCase();
  return key || "";
}

export function ProposalDetailModal({
  isOpen,
  onClose,
  proposal,
  session,
  planetImagesLandscape,
  planetIcons,
  canCurrentUserApprove,
  highThreshold,
  onApprove,
  onExecute,
  onCancel,
  onCleanup,
}: ProposalDetailModalProps) {
  const [expandedActions, setExpandedActions] = useState<
    Record<number, boolean>
  >({});
  const [loadingAction, setLoadingAction] = useState(false);
  const [decodedActions, setDecodedActions] = useState<DecodedActionDetails[]>(
    [],
  );
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [executedTxId, setExecutedTxId] = useState<string | null>(null);
  const [executedTxLoading, setExecutedTxLoading] = useState(false);
  const executedTxCacheRef = useRef<Map<string, string>>(new Map());
  const cleanupTooltipId = useId();

  const apiClient = useMemo(() => getApiClient(session), [session]);

  useEffect(() => {
    if (!isOpen || !proposal) {
      setDecodedActions([]);
      setDecodeError(null);
      setExpandedActions({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoadingAction(true);
      setDecodeError(null);
      try {
        const res = await decodePackedTransaction(
          apiClient,
          proposal.packed_transaction,
        );
        if (!cancelled) {
          setDecodedActions(res);
        }
      } catch (err) {
        if (!cancelled) {
          setDecodeError(
            err instanceof Error ? err.message : "Failed to decode action",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAction(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [apiClient, isOpen, proposal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
    }
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !proposal) {
      setExecutedTxId(null);
      setExecutedTxLoading(false);
      return;
    }
    if (proposal.status !== "executed") {
      setExecutedTxId(null);
      setExecutedTxLoading(false);
      return;
    }

    const cacheKey = `${proposal.dac_id}::${proposal.proposal_name}`;
    const cachedTxId = executedTxCacheRef.current.get(cacheKey);
    if (cachedTxId) {
      setExecutedTxId(cachedTxId);
      setExecutedTxLoading(false);
      return;
    }

    let cancelled = false;
    const lookupTxId = async () => {
      setExecutedTxLoading(true);
      try {
        const txId = await fetchExecutedProposalTxId({
          dacId: proposal.dac_id,
          proposalName: proposal.proposal_name,
        });
        if (cancelled) return;
        if (txId) {
          executedTxCacheRef.current.set(cacheKey, txId);
        }
        setExecutedTxId(txId);
      } catch (err) {
        if (cancelled) return;
        setExecutedTxId(null);
      } finally {
        if (!cancelled) {
          setExecutedTxLoading(false);
        }
      }
    };

    void lookupTxId();
    return () => {
      cancelled = true;
    };
  }, [isOpen, proposal]);

  if (!isOpen || !proposal) return null;

  const currentUser = session.actor.toString();
  const isProposer = proposal.createdBy === currentUser;
  const [approvalCount, approvalThreshold] = (() => {
    const parts = String(proposal.approvals ?? "").split("/");
    const count = Number(parts[0]);
    const threshold = Number(parts[1]);
    return [
      Number.isFinite(count) ? count : 0,
      Number.isFinite(threshold) && threshold > 0 ? threshold : highThreshold,
    ] as const;
  })();
  const approvalsMet = approvalCount >= approvalThreshold;
  const canExecute =
    approvalsMet &&
    proposal.status !== "executed" &&
    proposal.status !== "cancelled" &&
    proposal.status !== "expired";

  const handleTx = async (fn: (p: Proposal) => Promise<void>) => {
    setTxLoading(true);
    try {
      await fn(proposal);
      onClose();
    } finally {
      setTxLoading(false);
    }
  };

  const planetKey = getPlanetKeyFromDaoLabel(proposal.dao);
  const landscape = planetImagesLandscape[planetKey] ?? "";
  const icon = planetIcons[planetKey] ?? "";
  const transactionLink = executedTxId
    ? `https://waxblock.io/transaction/${executedTxId}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-[600px] max-h-[min(95vh,95dvh)] bg-[#100F10] rounded-2xl border border-[#2E2E2E] shadow-2xl flex flex-col min-h-0 overflow-hidden font-titillium"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute z-20 flex items-center gap-1 top-3 right-3 sm:top-7 sm:right-7">
          <div
            className="flex items-center justify-center text-xs"
            style={{
              width: "75px",
              height: "24px",
              borderRadius: "6px",
              border: "1px solid #2E2E2E",
              background: "#100F10",
              color: statusColor(proposal.status),
            }}
          >
            {statusLabel(proposal.status)}
          </div>

          {proposal.status !== "pending" && (
            <span className="group relative inline-flex">
              <button
                type="button"
                onClick={() => void handleTx(onCleanup)}
                disabled={txLoading}
                className="inline-flex items-center disabled:opacity-50"
                style={{
                  height: "24px",
                  padding: "0 12px",
                  gap: "25px",
                  borderRadius: "6px",
                  border: "1px solid #3D3D3D",
                  background: "#000",
                }}
                title="Runs msig.worlds cleanup: removes this proposal from on-chain tables (dac_id + proposal_name)."
                aria-label="Cleanup proposal on blockchain"
                aria-describedby={cleanupTooltipId}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M14.0466 3.48671C12.9733 3.38004 11.8999 3.30004 10.8199 3.24004V3.23337L10.6733 2.36671C10.5733 1.75337 10.4266 0.833374 8.86661 0.833374H7.11994C5.56661 0.833374 5.41994 1.71337 5.31328 2.36004L5.17328 3.21337C4.55328 3.25337 3.93328 3.29337 3.31328 3.35337L1.95328 3.48671C1.67328 3.51337 1.47328 3.76004 1.49994 4.03337C1.52661 4.30671 1.76661 4.50671 2.04661 4.48004L3.40661 4.34671C6.89994 4.00004 10.4199 4.13337 13.9533 4.48671C13.9733 4.48671 13.9866 4.48671 14.0066 4.48671C14.2599 4.48671 14.4799 4.29337 14.5066 4.03337C14.5266 3.76004 14.3266 3.51337 14.0466 3.48671Z"
                    fill="#FF3B52"
                  />
                  <path
                    d="M12.8202 5.42663C12.6602 5.25996 12.4402 5.16663 12.2135 5.16663H3.78683C3.56016 5.16663 3.33349 5.25996 3.18016 5.42663C3.02683 5.59329 2.94016 5.81996 2.95349 6.05329L3.36683 12.8933C3.44016 13.9066 3.53349 15.1733 5.86016 15.1733H10.1402C12.4668 15.1733 12.5602 13.9133 12.6335 12.8933L13.0468 6.05996C13.0602 5.81996 12.9735 5.59329 12.8202 5.42663ZM9.10682 11.8333H6.88683C6.61349 11.8333 6.38683 11.6066 6.38683 11.3333C6.38683 11.06 6.61349 10.8333 6.88683 10.8333H9.10682C9.38016 10.8333 9.60682 11.06 9.60682 11.3333C9.60682 11.6066 9.38016 11.8333 9.10682 11.8333ZM9.66683 9.16663H6.33349C6.06016 9.16663 5.83349 8.93996 5.83349 8.66663C5.83349 8.39329 6.06016 8.16663 6.33349 8.16663H9.66683C9.94016 8.16663 10.1668 8.39329 10.1668 8.66663C10.1668 8.93996 9.94016 9.16663 9.66683 9.16663Z"
                    fill="#FF3B52"
                  />
                </svg>
              </button>
              <span
                id={cleanupTooltipId}
                role="tooltip"
                className="pointer-events-none invisible absolute right-0 top-[calc(100%+6px)] z-[60] w-max max-w-[min(240px,calc(100vw-48px))] rounded-md border border-[#2E2E2E] bg-[#1A191A] px-2 py-1 text-left text-[11px] leading-snug text-white/90 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
              >
                Removes this proposal from msig.worlds tables (cleanup action).
              </span>
            </span>
          )}
        </div>
        {/* Content (includes image inside padded body) */}
        <div className="px-4 sm:px-6 pt-14 sm:pt-6 pb-4 sm:pb-5 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
          {/* Planet landscape image inside body padding */}
          <div className="w-full h-32 min-h-32 flex-none shrink-0 rounded-xl overflow-hidden border border-[#2E2E2E]">
            {landscape ? (
              <img
                src={landscape}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#0F5581] via-[#B8B12C] to-[#D3C01F]" />
            )}
          </div>
          {/* Info grid (Title first) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
            <div className="min-w-0">
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Title
              </div>
              <div className="proposal-detail-value mt-1 break-words">
                {proposal.title || "—"}
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                DAO
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="relative w-4 h-4 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[conic-gradient(at_top_left,_#0F5581,_#748C4F,_#B8B12C,_#D3C01F)]" />
                  {icon && (
                    <img
                      src={icon}
                      alt=""
                      className="absolute inset-[0.5px] w-[14px] h-[14px] rounded-full object-cover shadow-inner"
                    />
                  )}
                </div>
                <span className="proposal-detail-value">{proposal.dao}</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Memo
              </div>
              <div className="proposal-detail-value mt-1 break-words">
                {proposal.memo || "—"}
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Expire Date
              </div>
              <div className="proposal-detail-value mt-1">
                {proposal.expireDate}
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Approval Rate
              </div>
              <div className="proposal-detail-value mt-1">
                {proposal.approvals} (threshold {highThreshold})
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Created by
              </div>
              <div className="proposal-detail-value font-mono mt-1">
                {proposal.createdBy}
              </div>
            </div>
            {proposal.status === "executed" && (
              <div className="min-w-0 sm:col-span-2">
                <div className="text-white text-[14px] font-bold leading-[22.4px]">
                  Transaction
                </div>
                <div className="proposal-detail-value font-mono mt-1 break-all">
                  {executedTxLoading ? (
                    <span className="text-white/70" aria-live="polite" aria-busy>
                      Loading tx id...
                    </span>
                  ) : transactionLink ? (
                    <a
                      href={transactionLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0ED4A8] hover:text-[#45e1bf] underline underline-offset-2"
                    >
                      {executedTxId}
                    </a>
                  ) : (
                    <span className="text-white/60">Not indexed yet</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-1">
            <div className="text-white text-[14px] font-bold leading-[22.4px] mb-1">
              Description
            </div>
            <div className="proposal-detail-value max-h-32 overflow-auto pr-1">
              {proposal.description || "No description provided."}
            </div>
          </div>

          {/* Action cards (after description) */}
          <div className="space-y-3">
            {decodedActions.map((action, index) => {
              const isExpanded = !!expandedActions[index];
              return (
                <div
                  key={`${action.contract}::${action.name}::${index}`}
                  className="w-full bg-[#100F10] border border-[#2E2E2E] rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.5)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="text-white text-[14px] font-bold leading-[22.4px]">
                        Action
                      </div>
                      <div className="proposal-detail-value mt-1 break-words">
                        <span className="text-white/50">[Con] </span>
                        {action.contract + " - "}{" "}
                        <span className="text-white/50">[Act]</span>{" "}
                        {action.name}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedActions((prev) => ({
                          ...prev,
                          [index]: !prev[index],
                        }))
                      }
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors flex-shrink-0 mt-1"
                      aria-label={
                        isExpanded
                          ? "Collapse action details"
                          : "Expand action details"
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`transition-transform ${
                          isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <path
                          d="M13 6L8 11L3 6"
                          stroke="#777778"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#2E2E2E]">
                      <div className="proposal-detail-value grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(action.data ?? {}).map(
                          ([key, value]) => {
                            const label = key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            return (
                              <div key={key} className="min-w-0">
                                <div className="text-white text-[14px] font-bold leading-[22.4px]">
                                  {label}
                                </div>
                                <div className="proposal-detail-value break-words">
                                  {String(value)}
                                </div>
                              </div>
                            );
                          },
                        )}
                        {!action.data ||
                        Object.keys(action.data).length === 0 ? (
                          <div className="sm:col-span-2 proposal-detail-value">
                            No decoded fields available for this action.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {decodedActions.length === 0 && !loadingAction && !decodeError && (
              <div className="w-full bg-[#100F10] border border-[#2E2E2E] rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.5)] p-4">
                <div className="text-white text-[14px] font-bold leading-[22.4px]">
                  Action
                </div>
                <div className="proposal-detail-value mt-1">
                  {MSIG_CONTRACT + " - " + proposal.proposal_name}
                </div>
              </div>
            )}

            {decodeError && (
              <div className="proposal-detail-value text-[11px] text-red-400 mt-1">
                {decodeError}
              </div>
            )}
            {loadingAction && decodedActions.length === 0 && !decodeError && (
              <div className="proposal-detail-value text-[11px] mt-1">
                Decoding action...
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 border-t border-[#2E2E2E] flex-shrink-0 bg-[#100F10]">
          <button
            type="button"
            onClick={onClose}
            className="proposal-detail-neutral-btn inline-flex items-center justify-center w-full sm:w-auto min-h-9 px-6 rounded-md font-titillium text-white text-sm font-bold bg-gradient-to-b from-[#3D3D3D] to-[#1C1C1C] shadow-[inset_0_-1px_2px_0_#000,inset_0_1px_2px_0_rgba(251,251,251,0.25)]"
          >
            Close
          </button>

          <div className="flex flex-wrap items-stretch sm:items-center justify-end gap-2 w-full sm:w-auto">
            {canExecute && (
              <button
                type="button"
                onClick={() => void handleTx(onExecute)}
                disabled={txLoading}
                className="msig-execute-btn !w-auto min-w-[5.5rem] flex-1 sm:flex-initial justify-center px-3 whitespace-nowrap"
              >
                {txLoading ? "Processing..." : "Execute"}
              </button>
            )}
            {isProposer &&
              (proposal.status === "pending" ||
                proposal.status === "approved") && (
                <button
                  type="button"
                  onClick={() => void handleTx(onCancel)}
                  disabled={txLoading}
                  className="proposal-detail-neutral-btn inline-flex items-center justify-center min-h-9 px-4 sm:px-6 rounded-md text-white text-sm font-bold font-titillium flex-1 sm:flex-initial bg-gradient-to-b from-[#FF3B52] to-[#D52F42] shadow-[inset_0_-1px_2px_0_#72000D,inset_0_1px_2px_0_#F7B3BB] whitespace-nowrap"
                >
                  {txLoading ? "Processing..." : "Cancel MSIG"}
                </button>
              )}
            {proposal.status === "pending" && proposal.hasApproved && (
              <span
                className={`inline-flex items-center justify-center px-4 py-2 min-h-9 text-sm font-bold font-titillium ${statusColor(
                  "approved",
                )}`}
              >
                You approved
              </span>
            )}
            {proposal.status === "pending" &&
              !proposal.hasApproved &&
              canCurrentUserApprove && (
                <button
                  type="button"
                  onClick={() => void handleTx(onApprove)}
                  disabled={txLoading}
                  className="msig-approve-btn !w-auto min-w-[5.5rem] flex-1 sm:flex-initial justify-center px-3 whitespace-nowrap text-sm font-bold font-titillium"
                >
                  {txLoading ? "Processing..." : "Approve"}
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
