import { useMemo, useState } from "react";
import type { Option } from "@alien-worlds/uikit";
import type { ProposalAction } from "./types";

interface CreateProposalStep3Props {
  title: string;
  description: string;
  memo: string;
  proposer: string;
  expireDate: string;
  selectedPlanet: Option | null;
  selectedDao: Option | null;
  actions: ProposalAction[];
  planetImagesDetails?: Record<string, string>;
  planetIcons: Record<string, string>;
  submitError: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (value == null) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDaoLabel(
  selectedPlanet: Option | null,
  selectedDao: Option | null,
): string {
  if (selectedPlanet?.label && selectedDao?.label) {
    return `${selectedPlanet.label} ${selectedDao.label}`;
  }
  return selectedPlanet?.label ?? selectedDao?.label ?? "—";
}

export function CreateProposalStep3({
  title,
  description,
  memo,
  proposer,
  expireDate,
  selectedPlanet,
  selectedDao,
  actions,
  planetImagesDetails,
  planetIcons,
  submitError,
  isSubmitting,
  onCancel: _onCancel,
  onBack,
  onConfirm,
}: CreateProposalStep3Props) {
  const [expandedActions, setExpandedActions] = useState<
    Record<number, boolean>
  >({});

  const validActions = useMemo(
    () =>
      actions.filter(
        (a) => a.contractName && a.selectedAction && a.contractAbi,
      ),
    [actions],
  );

  const daoLabel = buildDaoLabel(selectedPlanet, selectedDao);
  const planetKey = selectedPlanet?.value ?? "";
  const landscape = planetImagesDetails?.[planetKey] ?? "";
  const icon = planetIcons[planetKey] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative w-[600px] min-w-[600px] max-w-[95vw] max-h-[95vh] bg-[#100F10] rounded-2xl border border-[#2E2E2E] shadow-2xl flex flex-col overflow-hidden font-titillium"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 pt-6 pb-5 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto relative">
          <div className="flex flex-col items-center text-center">
            <div
              className="font-inter text-[24px] font-semibold leading-[160%]"
              style={{
                background:
                  "linear-gradient(180deg, #FFF 38.79%, #8F8E8E 81.03%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Create Confirmation
            </div>
            <div className="text-[#B9B9B9] font-titillium text-[14px] font-normal leading-[160%]">
              Please, carefully review your General MSIG proposal data and
              confirm creation
            </div>
          </div>

          <div className="w-full h-32 flex-shrink-0 rounded-xl overflow-hidden border border-[#2E2E2E]">
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

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs">
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Title
              </div>
              <div className="proposal-detail-value max-w-xs mt-1">
                {title || "—"}
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
                <span className="proposal-detail-value">{daoLabel}</span>
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Memo
              </div>
              <div className="proposal-detail-value max-w-xs mt-1">
                {memo || "—"}
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Expire Date
              </div>
              <div className="proposal-detail-value mt-1">
                {expireDate || "—"}
              </div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Approval Rate
              </div>
              <div className="proposal-detail-value mt-1">Pending</div>
            </div>
            <div>
              <div className="text-white text-[14px] font-bold leading-[22.4px]">
                Created by
              </div>
              <div className="proposal-detail-value font-mono mt-1">
                {proposer || "—"}
              </div>
            </div>
          </div>

          <div className="mt-1">
            <div className="text-white text-[14px] font-bold leading-[22.4px] mb-1">
              Description
            </div>
            <div className="proposal-detail-value max-h-32 overflow-auto pr-1">
              {description || "No description provided."}
            </div>
          </div>

          <div className="space-y-3">
            {validActions.map((action, index) => {
              const isExpanded = expandedActions[index] ?? false;
              return (
                <div
                  key={`${action.id}-${index}`}
                  className="w-full bg-[#100F10] border border-[#2E2E2E] rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.5)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white text-[14px] font-bold leading-[22.4px]">
                        {index === 0 ? "Action" : `Action ${index + 1}`}
                      </div>
                      <div className="proposal-detail-value mt-1">
                        {action.contractName} - {action.selectedAction}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedActions((prev) => ({
                          ...prev,
                          [index]: !isExpanded,
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
                      <div className="proposal-detail-value grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(action.formValues ?? {}).map(
                          ([k, v]) => {
                            const label = k
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            return (
                              <div key={k}>
                                <div className="text-white text-[14px] font-bold leading-[22.4px]">
                                  {label}
                                </div>
                                <div className="proposal-detail-value">
                                  {stringifyValue(v)}
                                </div>
                              </div>
                            );
                          },
                        )}
                        {Object.keys(action.formValues ?? {}).length === 0 && (
                          <div className="col-span-2 proposal-detail-value">
                            No input fields for this action.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-5 pt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="proposal-detail-neutral-btn inline-flex items-center justify-center h-9 px-6 rounded-[6px] text-white text-[14px] font-bold font-titillium"
              style={{
                minWidth: "120px",
                background: "linear-gradient(180deg, #3D3D3D 0%, #1C1C1C 100%)",
                boxShadow:
                  "0px 1px 2px rgba(251,251,251,0.25) inset, 0px -1px 2px black inset",
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="create-proposal-next-btn"
            >
              {isSubmitting ? "Submitting..." : "Confirm"}
            </button>
          </div>
          <div className="text-xs text-[#777778]">
            Creating proposal step 3 of 3
          </div>
        </div>
        {submitError && (
          <div className="px-6 pb-4">
            <span className="text-sm text-red-400 font-titillium">
              {submitError}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
