import { useMemo, useState } from "react";
import { Search2Icon } from "@alien-worlds/icons";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Option } from "@alien-worlds/uikit";
import { getActionFields } from "@/utils/abiForm";
import { getDacId, getDacProposer } from "@/types/msig";
import { ActionFieldInput } from "./ActionFieldInput";
import type { ProposalAction } from "./types";

export interface CreateProposalStep2PropsLeft {
  slot: "left";
  actions: ProposalAction[];
  activeActionId: string | null;
  setActiveActionId: (id: string) => void;
  onExpandToggle: (actionId: string) => void;
  addAction: () => void;
  removeAction: (id: string) => void;
  duplicateAction: (id: string) => void;
  updateAction: (
    id: string,
    updater: (a: ProposalAction) => Partial<ProposalAction>,
  ) => void;
  reorderActions: (newOrder: ProposalAction[]) => void;
  loadContractAbi: (actionId: string, accountName: string) => void;
  handleContractSelect: (actionId: string, name: string) => void;
  handleContractSearchSubmit: (actionId: string) => void;
  isLoadingAbi: boolean;
  loadingActionId: string | null;
  suggestionsOpenForActionId: string | null;
  setSuggestionsOpenForActionId: (id: string | null) => void;
  recentFiltered: string[];
  knownFiltered: string[];
  hasSuggestions: boolean;
  selectedPlanet: Option | null;
  selectedDao: Option | null;
  planetImages: Record<string, string>;
  planetImagesLandscape?: Record<string, string>;
  planetIcons: Record<string, string>;
}

export interface CreateProposalStep2PropsRight {
  slot: "right";
  actions: ProposalAction[];
  activeAction: ProposalAction;
  setFieldValue: (actionId: string, fieldName: string, value: unknown) => void;
  validateFieldBlur: (
    actionId: string,
    fieldName: string,
    abiType: string,
    value: unknown,
  ) => void;
  selectedPlanet: Option | null;
  selectedDao: Option | null;
  planetImages: Record<string, string>;
  planetImagesLandscape?: Record<string, string>;
  planetIcons: Record<string, string>;
}

export type CreateProposalStep2Props =
  | CreateProposalStep2PropsLeft
  | CreateProposalStep2PropsRight;

function ActionCardPreview({
  action,
  index,
  isExpanded,
}: {
  action: ProposalAction;
  index: number;
  isExpanded: boolean;
}) {
  const title = index === 0 ? "Action" : `Action ${index + 1}`;
  const hasContract = !!action.contractName;
  const hasAction = !!action.selectedAction;

  return (
    <div
      className={`w-full min-w-[260px] rounded-[16px] border border-[#2E2E2E] bg-[#100F10] flex flex-col flex-shrink-0 shadow-lg ${
        isExpanded
          ? hasContract
            ? "border-[#777778] min-h-[275px]"
            : "min-h-[135px]"
          : "min-h-[83px]"
      }`}
    >
      {isExpanded ? (
        <div className="p-4 space-y-3 flex flex-col">
          <div className="flex flex-col flex-1">
            <h3 className="text-white text-lg font-titillium font-bold leading-[28.8px]">
              {title}
            </h3>
            {hasAction && (
              <p className="text-sm font-titillium leading-[22.4px]">
                <span className="text-[#B9B9B9]">
                  {" "}
                  {action.contractName} -{" "}
                </span>
                <span className="text-[#B9B9B9]"> {action.selectedAction}</span>
              </p>
            )}
            {!hasAction && (
              <p className="text-[#B9B9B9] text-sm font-titillium leading-[22.4px]">
                Select contract to see the list of available actions within
                contract
              </p>
            )}
          </div>
          <div className="h-9 rounded-md bg-black/50" />
        </div>
      ) : (
        <div className="p-4 flex items-center justify-between">
          <div className="flex flex-col flex-1">
            <h3 className="text-white text-lg font-titillium font-bold leading-[28.8px]">
              {title}
            </h3>
            <p className="text-sm font-titillium leading-[22.4px]">
              <span className="text-[#B9B9B9]"> {action.contractName} - </span>
              <span className="text-[#B9B9B9]"> {action.selectedAction}</span>
            </p>
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="px-4 pb-4 flex items-center justify-end">
          <div className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="5"
      viewBox="0 0 10 5"
      fill="none"
      className={className}
      style={{ transform: "rotate(180deg)" }}
    >
      <path
        d="M1 1L5 4L9 1"
        stroke="#777778"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M14.0471 3.48659C12.9738 3.37992 11.9004 3.29992 10.8204 3.23992V3.23325L10.6738 2.36659C10.5738 1.75325 10.4271 0.833252 8.8671 0.833252H7.12043C5.5671 0.833252 5.42043 1.71325 5.31376 2.35992L5.17376 3.21325C4.55376 3.25325 3.93376 3.29325 3.31376 3.35325L1.95376 3.48659C1.67376 3.51325 1.47376 3.75992 1.50043 4.03325C1.5271 4.30659 1.7671 4.50659 2.0471 4.47992L3.4071 4.34659C6.90043 3.99992 10.4204 4.13325 13.9538 4.48659C13.9738 4.48659 13.9871 4.48659 14.0071 4.48659C14.2604 4.48659 14.4804 4.29325 14.5071 4.03325C14.5271 3.75992 14.3271 3.51325 14.0471 3.48659Z"
        fill="#FF4D4F"
      />
      <path
        d="M12.8202 5.42675C12.6602 5.26008 12.4402 5.16675 12.2135 5.16675H3.78683C3.56016 5.16675 3.33349 5.26008 3.18016 5.42675C3.02683 5.59341 2.94016 5.82008 2.95349 6.05341L3.36683 12.8934C3.44016 13.9067 3.53349 15.1734 5.86016 15.1734H10.1402C12.4668 15.1734 12.5602 13.9134 12.6335 12.8934L13.0468 6.06008C13.0602 5.82008 12.9735 5.59341 12.8202 5.42675ZM9.10682 11.8334H6.88683C6.61349 11.8334 6.38683 11.6067 6.38683 11.3334C6.38683 11.0601 6.61349 10.8334 6.88683 10.8334H9.10682C9.38016 10.8334 9.60682 11.0601 9.60682 11.3334C9.60682 11.6067 9.38016 11.8334 9.10682 11.8334ZM9.66683 9.16675H6.33349C6.06016 9.16675 5.83349 8.94008 5.83349 8.66675C5.83349 8.39341 6.06016 8.16675 6.33349 8.16675H9.66683C9.94016 8.16675 10.1668 8.39341 10.1668 8.66675C10.1668 8.94008 9.94016 9.16675 9.66683 9.16675Z"
        fill="#FF4D4F"
      />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M10.333 8.76675H8.88634C7.69967 8.76675 6.73301 7.80675 6.73301 6.61341V5.16675C6.73301 4.89341 6.51301 4.66675 6.23301 4.66675H4.11967C2.57967 4.66675 1.33301 5.66675 1.33301 7.45341V11.8801C1.33301 13.6667 2.57967 14.6667 4.11967 14.6667H8.04634C9.58634 14.6667 10.833 13.6667 10.833 11.8801V9.26675C10.833 8.98675 10.6063 8.76675 10.333 8.76675Z"
        fill="#B9B9B9"
      />
      <path
        d="M11.8795 1.33325H10.5662H9.83952H7.95285C6.44618 1.33325 5.22618 2.29325 5.17285 4.00659C5.21285 4.00659 5.24618 3.99992 5.28618 3.99992H7.17285H7.89952H9.21285C10.7529 3.99992 11.9995 4.99992 11.9995 6.78659V8.09992V9.90658V11.2199C11.9995 11.2599 11.9929 11.2933 11.9929 11.3266C13.4795 11.2799 14.6662 10.2933 14.6662 8.55325V7.23992V5.43325V4.11992C14.6662 2.33325 13.4195 1.33325 11.8795 1.33325Z"
        fill="#B9B9B9"
      />
      <path
        d="M7.98676 4.76674C7.78009 4.56008 7.42676 4.70008 7.42676 4.98674V6.73341C7.42676 7.46674 8.04676 8.06674 8.80676 8.06674C9.28009 8.07341 9.94009 8.07341 10.5068 8.07341C10.7934 8.07341 10.9401 7.74008 10.7401 7.54008C10.0134 6.81341 8.72009 5.51341 7.98676 4.76674Z"
        fill="#B9B9B9"
      />
    </svg>
  );
}

function HoverDotsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M10.6537 9.63118C11.5331 9.63118 12.2459 8.91832 12.2459 8.03898C12.2459 7.15963 11.5331 6.44678 10.6537 6.44678C9.77438 6.44678 9.06152 7.15963 9.06152 8.03898C9.06152 8.91832 9.77438 9.63118 10.6537 9.63118Z"
        fill="#777778"
      />
      <path
        d="M10.6537 3.1844C11.5331 3.1844 12.2459 2.47155 12.2459 1.5922C12.2459 0.712852 11.5331 0 10.6537 0C9.77438 0 9.06152 0.712852 9.06152 1.5922C9.06152 2.47155 9.77438 3.1844 10.6537 3.1844Z"
        fill="#777778"
      />
      <path
        d="M5.34611 9.63118C6.22545 9.63118 6.93831 8.91832 6.93831 8.03898C6.93831 7.15963 6.22545 6.44678 5.34611 6.44678C4.46676 6.44678 3.75391 7.15963 3.75391 8.03898C3.75391 8.91832 4.46676 9.63118 5.34611 9.63118Z"
        fill="#777778"
      />
      <path
        d="M5.34611 3.1844C6.22545 3.1844 6.93831 2.47155 6.93831 1.5922C6.93831 0.712852 6.22545 0 5.34611 0C4.46676 0 3.75391 0.712852 3.75391 1.5922C3.75391 2.47155 4.46676 3.1844 5.34611 3.1844Z"
        fill="#777778"
      />
      <path
        d="M10.6537 15.9998C11.5331 15.9998 12.2459 15.287 12.2459 14.4076C12.2459 13.5283 11.5331 12.8154 10.6537 12.8154C9.77438 12.8154 9.06152 13.5283 9.06152 14.4076C9.06152 15.287 9.77438 15.9998 10.6537 15.9998Z"
        fill="#777778"
      />
      <path
        d="M5.34611 15.9998C6.22545 15.9998 6.93831 15.287 6.93831 14.4076C6.93831 13.5283 6.22545 12.8154 5.34611 12.8154C4.46676 12.8154 3.75391 13.5283 3.75391 14.4076C3.75391 15.287 4.46676 15.9998 5.34611 15.9998Z"
        fill="#777778"
      />
    </svg>
  );
}

function SortableActionBlock({
  action,
  index,
  isFirstCard,
  isExpanded,
  isLoading,
  showSuggestions,
  hasSuggestions,
  recentFiltered,
  knownFiltered,
  onUpdate,
  onContractSelect,
  onContractSearchSubmit,
  onExpandToggle,
  onRemove,
  onDuplicate,
  onSetSuggestionsOpen,
  onFocusContractInput,
}: {
  action: ProposalAction;
  index: number;
  isFirstCard: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  showSuggestions: boolean;
  hasSuggestions: boolean;
  recentFiltered: string[];
  knownFiltered: string[];
  onUpdate: (updater: (a: ProposalAction) => Partial<ProposalAction>) => void;
  onContractSelect: (name: string) => void;
  onContractSearchSubmit: () => void;
  onExpandToggle: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onSetSuggestionsOpen: (open: boolean) => void;
  onFocusContractInput: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const title = index === 0 ? "Action" : `Action ${index + 1}`;
  const hasContract = !!action.contractName;
  const hasAction = !!action.selectedAction;

  const blockContent = (
    <div className="relative group w-full">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
        <HoverDotsIcon />
      </div>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`w-full rounded-[16px] border border-[#2E2E2E] bg-[#100F10] flex flex-col transition-colors cursor-grab active:cursor-grabbing ${
          isExpanded
            ? hasContract
              ? "border-[#777778] min-h-[275px]"
              : "min-h-[135px]"
            : "min-h-[83px]"
        } ${!isExpanded ? "hover:bg-[#1F1F1F]" : ""} ${
          isDragging ? "opacity-0 pointer-events-none" : ""
        }`}
      >
        {isExpanded ? (
          <div className="pt-4 pr-4 pb-4 pl-5 space-y-3 flex flex-col">
            <div className="flex items-start justify-between gap-3 flex-1">
              <div className="flex flex-col min-w-0">
                <h3 className="text-white text-lg font-titillium font-bold leading-[28.8px]">
                  {title}
                </h3>
                {hasAction && (
                  <p className="text-sm font-titillium leading-[22.4px]">
                    <span className="text-[#777778]">[Con] </span>
                    <span className="text-[#B9B9B9]">
                      {" "}
                      {action.contractName} -{" "}
                    </span>
                    <span className="text-[#777778]">[Act] </span>
                    <span className="text-[#B9B9B9]">
                      {" "}
                      {action.selectedAction}
                    </span>
                  </p>
                )}
                {!hasAction && (
                  <p className="text-[#B9B9B9] text-sm font-titillium leading-[22.4px]">
                    Select contract to see the list of available actions within
                    contract
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandToggle();
                }}
                aria-label="Collapse"
                className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-white/10 flex-shrink-0"
              >
                <ChevronUpIcon />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <div
                  className={`flex items-center justify-between h-9 px-3 bg-black rounded-md outline outline-1 outline-[#3D3D3D] outline-offset-[-1px] w-full ${
                    action.abiError ? "outline-red-400" : ""
                  } ${isLoading ? "opacity-70" : ""}`}
                >
                  <input
                    type="text"
                    placeholder="Search contract..."
                    value={action.contractSearch}
                    onChange={(e) =>
                      onUpdate(() => ({
                        contractSearch: e.target.value,
                        abiError: "",
                      }))
                    }
                    onFocus={() => {
                      onFocusContractInput();
                      onSetSuggestionsOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        onContractSearchSubmit();
                        return;
                      }
                      if (
                        e.key === "Tab" &&
                        showSuggestions &&
                        hasSuggestions
                      ) {
                        const firstSuggestion =
                          recentFiltered[0] ?? knownFiltered[0];
                        if (firstSuggestion) {
                          e.preventDefault();
                          e.stopPropagation();
                          onContractSelect(firstSuggestion);
                        }
                      }
                    }}
                    onBlur={() =>
                      setTimeout(() => onSetSuggestionsOpen(false), 150)
                    }
                    disabled={isLoading}
                    className="flex-1 min-w-0 bg-transparent text-white text-xs font-titillium placeholder:text-[#777778]/80 outline-none"
                  />
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onContractSearchSubmit();
                    }}
                    disabled={isLoading || !action.contractSearch.trim()}
                    aria-label="Search contract"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-sm hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Search2Icon boxSize={12} color="rgba(255,255,255,0.6)" />
                  </button>
                </div>
                {showSuggestions && hasSuggestions && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-2 rounded-lg border border-white/10 bg-[#100F10] shadow-lg min-h-[80px] max-h-72 overflow-auto py-1">
                    {recentFiltered.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-medium text-white/50 font-orbitron uppercase tracking-wider">
                          Recently used
                        </div>
                        {recentFiltered.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 font-titillium"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onContractSelect(name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </>
                    )}
                    {knownFiltered.length > 0 && (
                      <>
                        <div
                          className={`px-4 py-2 text-xs font-medium text-white/50 font-orbitron uppercase tracking-wider ${
                            recentFiltered.length > 0
                              ? "border-t border-white/10 mt-1 pt-2"
                              : ""
                          }`}
                        >
                          {recentFiltered.length > 0
                            ? "Suggestions"
                            : "Contracts"}
                        </div>
                        {knownFiltered.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 font-titillium"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onContractSelect(name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
                {action.abiError && (
                  <p className="mt-1 text-sm text-red-400 font-titillium">
                    {action.abiError}
                  </p>
                )}
                {isLoading && (
                  <p className="mt-1 text-sm text-white/60 font-titillium">
                    Loading contract...
                  </p>
                )}
              </div>
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="h-9 w-9 rounded-md outline outline-1 outline-[#3D3D3D] outline-offset-[-1px] flex items-center justify-center hover:bg-white/10 flex-shrink-0"
                  aria-label="Duplicate"
                >
                  <DuplicateIcon />
                </button>
                {!isFirstCard && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    className="h-9 w-9 rounded-md outline outline-1 outline-[#3D3D3D] outline-offset-[-1px] flex items-center justify-center hover:bg-white/10 flex-shrink-0"
                    aria-label="Delete"
                  >
                    <DeleteIcon />
                  </button>
                )}
              </>
            </div>

            {hasContract && action.contractActions.length > 0 && (
              <div className="grid grid-cols-3 gap-2 max-h-[11.5rem] overflow-y-auto">
                {action.contractActions.map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() =>
                      onUpdate(() => ({
                        selectedAction: act,
                        formValues: {},
                        formErrors: {},
                      }))
                    }
                    className={`h-8 px-4 py-1.5 rounded-md justify-center items-center inline-flex font-titillium text-xs font-semibold ${
                      action.selectedAction === act
                        ? "bg-white text-[#100F10]"
                        : "bg-[#1F1F1F] text-[#B9B9B9]"
                    }`}
                  >
                    <span className="text-center">{act}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="pt-4 pr-4 pb-4 pl-5 flex items-center justify-between cursor-pointer"
            onClick={onExpandToggle}
          >
            <div className="flex flex-col  flex-1">
              <h3 className="text-white text-lg font-titillium font-bold leading-[28.8px]">
                {title}
              </h3>
              <p className="text-sm font-titillium leading-[22.4px]">
                <span className="text-[#777778]">[Con] </span>
                <span className="text-[#B9B9B9]">
                  {" "}
                  {action.contractName} -{" "}
                </span>
                <span className="text-[#777778]">[Act] </span>
                <span className="text-[#B9B9B9]"> {action.selectedAction}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return blockContent;
}

export function CreateProposalStep2(props: CreateProposalStep2Props) {
  if (props.slot === "right") {
    const {
      activeAction,
      setFieldValue,
      validateFieldBlur,
      selectedPlanet,
      selectedDao,
      planetImages,
      planetImagesLandscape,
      planetIcons,
    } = props;

    const dacId = getDacId(
      selectedPlanet?.value ?? "eyeke",
      (selectedDao?.value as "syndicate" | "union") ?? "syndicate",
    );
    const mappedProposer = getDacProposer(dacId);
    const actionFields = useMemo(() => {
      if (!activeAction.contractAbi || !activeAction.selectedAction) return [];
      return getActionFields(
        activeAction.contractAbi,
        activeAction.selectedAction,
      );
    }, [activeAction.contractAbi, activeAction.selectedAction]);

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden gap-4">
        <div className="hidden lg:grid grid-cols-2 gap-4 flex-shrink-0">
          <div className="rounded-[12px] bg-black h-10 flex items-center justify-between gap-3 px-4 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              {planetIcons[selectedPlanet?.value ?? "eyeke"] && (
                <img
                  src={planetIcons[selectedPlanet?.value ?? "eyeke"]}
                  alt=""
                  className="w-[18px] h-[18px] rounded-full object-cover flex-shrink-0"
                />
              )}
              <span className="create-proposal-planet-label capitalize truncate">
                {selectedPlanet?.label ?? "Planet"}
              </span>
              <span className="text-[#777778] text-right font-titillium text-xs truncate flex-shrink-0">
                {selectedDao?.label ?? "DAO"}
              </span>
            </div>

            <span className="text-[#777778] text-right font-titillium text-xs truncate flex-shrink-0">
              {mappedProposer ?? "-"}
            </span>
          </div>
          <div className="hidden lg:block rounded-[12px] h-10 overflow-hidden bg-black">
            <img
              src={
                (planetImagesLandscape ?? planetImages)[
                  selectedPlanet?.value ?? "eyeke"
                ] ?? ""
              }
              alt=""
              className="w-full h-full object-cover min-h-[40px]"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 rounded-[12px] bg-black flex flex-col p-6 overflow-hidden">
          {activeAction.selectedAction && activeAction.contractAbi ? (
            actionFields.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-white/60 font-titillium">
                  No parameters for this action.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                <h3 className="text-white font-titillium text-[16px] font-bold leading-[160%] mb-1 flex-shrink-0">
                  {activeAction.selectedAction ?? ""}
                </h3>
                <p className="text-white/60 font-titillium text-xs mb-4 flex-shrink-0">
                  Fill all the required inputs, please
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                  {actionFields.map((field) => (
                    <ActionFieldInput
                      key={field.name}
                      field={field}
                      value={activeAction.formValues[field.name]}
                      error={activeAction.formErrors[field.name]}
                      onValueChange={(v) =>
                        setFieldValue(activeAction.id, field.name, v)
                      }
                      onBlur={() =>
                        validateFieldBlur(
                          activeAction.id,
                          field.name,
                          field.type,
                          activeAction.formValues[field.name],
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col h-full justify-center items-start gap-6 py-4">
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "35%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "75%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "100%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "100%" }}
              />
              <p className="max-w-[27ch] mx-auto text-sm text-white/60 font-titillium text-center py-2 flex-shrink-0">
                The form will appear after selecting the action in the contract.
              </p>
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "100%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "80%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "100%" }}
              />
              <div
                className="h-10 rounded-lg skeleton flex-shrink-0"
                style={{ width: "35%" }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  const {
    actions,
    setActiveActionId,
    onExpandToggle,
    addAction,
    removeAction,
    duplicateAction,
    updateAction,
    reorderActions,
    handleContractSelect,
    handleContractSearchSubmit,
    loadingActionId,
    suggestionsOpenForActionId,
    setSuggestionsOpenForActionId,
    recentFiltered,
    knownFiltered,
    hasSuggestions,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space"],
      },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderActions(arrayMove(actions, oldIndex, newIndex));
      }
    }
  };

  const canAddAction = actions.some(
    (a) => a.contractName && a.selectedAction && a.contractAbi,
  );

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={actions.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {actions.map((action, index) => (
            <SortableActionBlock
              key={action.id}
              action={action}
              index={index}
              isFirstCard={index === 0}
              isExpanded={action.isExpanded}
              isLoading={loadingActionId === action.id}
              showSuggestions={suggestionsOpenForActionId === action.id}
              hasSuggestions={hasSuggestions}
              recentFiltered={recentFiltered}
              knownFiltered={knownFiltered}
              onUpdate={(updater) => updateAction(action.id, updater)}
              onContractSelect={(name) => handleContractSelect(action.id, name)}
              onContractSearchSubmit={() =>
                handleContractSearchSubmit(action.id)
              }
              onExpandToggle={() => onExpandToggle(action.id)}
              onRemove={() => removeAction(action.id)}
              onDuplicate={() => duplicateAction(action.id)}
              onSetSuggestionsOpen={(open) =>
                setSuggestionsOpenForActionId(open ? action.id : null)
              }
              onFocusContractInput={() => setActiveActionId(action.id)}
            />
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId
            ? (() => {
                const action = actions.find((a) => a.id === activeId);
                return action ? (
                  <ActionCardPreview
                    action={action}
                    index={actions.indexOf(action)}
                    isExpanded={action.isExpanded}
                  />
                ) : null;
              })()
            : null}
        </DragOverlay>
      </DndContext>
      {canAddAction && (
        <button
          type="button"
          onClick={addAction}
          className="w-[160px] h-9 px-4 py-1.5 rounded-md bg-gradient-to-b from-[#3D3D3D] to-[#1C1C1C] shadow-[inset_0_1px_2px_rgba(251,251,251,0.25),inset_0_-1px_2px_black] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <span className="text-white text-xs font-titillium font-semibold">
            + Add Action
          </span>
        </button>
      )}
    </div>
  );
}
