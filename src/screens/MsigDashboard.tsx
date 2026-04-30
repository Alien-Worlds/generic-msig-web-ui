import { useState, useMemo, useEffect } from "react";
import CreateProposalView from "@/components/CreateProposalView";
import { WalletProviderIcon } from "@/components/WalletProviderIcon";
import type { Session } from "@wharfkit/session";
import type { Option } from "@alien-worlds/uikit";
import Select, { components } from "react-select";
import { getDacId, MSIG_CONTRACT, type ProposalStatus } from "@/types/msig";
import { useMsigProposals, type Proposal } from "@/hooks/useMsigProposals";
import {
  DAO_OPTIONS,
  DROPDOWN_STYLES,
  PLANET_OPTIONS,
} from "@/components/createProposal/createProposalConstants";
import { ProposalDetailModal } from "@/components/proposals/ProposalDetailModal";

const PLANET_IMAGES: Record<string, string> = {
  eyeke: "/assets/planets/eyeke.png",
  kavian: "/assets/planets/kavian.png",
  magor: "/assets/planets/magor.png",
  naron: "/assets/planets/naron.png",
  nerix: "/assets/planets/nerix.png",
  veles: "/assets/planets/veles.png",
  testa: "/assets/planets/eyeke.png", // TEMP: using eyeke image for testa (testing planet)
};
const PLANET_IMAGES_LANDSCAPE: Record<string, string> = {
  eyeke: "/assets/planets/eyeke-landscape.png",
  kavian: "/assets/planets/kavian-landscape.png",
  magor: "/assets/planets/magor-landscape.png",
  naron: "/assets/planets/naron-landscape.png",
  nerix: "/assets/planets/nerix-landscape.png",
  veles: "/assets/planets/veles-landscape.png",
  testa: "/assets/planets/eyeke-landscape.png", // TEMP: using eyeke image for testa (testing planet)
};
const PLANET_IMAGES_DETAIL: Record<string, string> = {
  eyeke: "/assets/planets/eyeke-detail.png",
  kavian: "/assets/planets/kavian-detail.png",
  magor: "/assets/planets/magor-detail.png",
  naron: "/assets/planets/naron-detail.png",
  nerix: "/assets/planets/nerix-detail.png",
  veles: "/assets/planets/veles-detail.png",
  testa: "/assets/planets/eyeke-detail.png", // TEMP: using eyeke image for testa (testing planet)
};
const PLANET_ICONS: Record<string, string> = {
  eyeke: "/assets/planets/eyeke.jpg",
  kavian: "/assets/planets/kavian.jpg",
  magor: "/assets/planets/magor.jpg",
  naron: "/assets/planets/naron.jpg",
  nerix: "/assets/planets/nerix.jpg",
  veles: "/assets/planets/veles.jpg",
  testa: "/assets/planets/eyeke.jpg", // TEMP: using eyeke icon for testa (testing planet)
};

function getPlanetImageForDao(dao: string): string | undefined {
  const key = dao.split(/\s+/)[0]?.toLowerCase();
  return key ? PLANET_IMAGES[key] : undefined;
}

function formatPlanetOption(
  option: Option,
  planetIcons: Record<string, string>,
) {
  const planetKey = String(option.value || "").toLowerCase();
  return (
    <div className="flex items-center gap-2">
      {planetIcons[planetKey] ? (
        <img
          src={planetIcons[planetKey]}
          alt=""
          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-amber-400/80 flex-shrink-0 block" />
      )}
      <span>{option.label}</span>
    </div>
  );
}

const PAGE_SIZE = 10;

/* ─── Inline SVG Icon Components (currentColor-driven) ─── */

function ClipboardTickIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M9.567 1.333H6.433a1.26 1.26 0 0 0-1.26 1.254v.626a1.26 1.26 0 0 0 1.254 1.254h3.14a1.26 1.26 0 0 0 1.253-1.254v-.626c.007-.69-.567-1.254-1.253-1.254Z"
        fill="currentColor"
      />
      <path
        d="M11.493 3.213c0 1.06-.866 1.927-1.926 1.927H6.433a1.93 1.93 0 0 1-1.927-1.927c0-.373-.4-.606-.733-.433a2.97 2.97 0 0 0-1.58 2.633v6.274a3.34 3.34 0 0 0 3.347 3.34h5.653c1.64 0 2.98-1.34 2.98-2.98V5.413a2.97 2.97 0 0 0-1.58-2.633c-.333-.174-.733.06-.733.433Zm-1.266 5.274-2.667 2.666a.503.503 0 0 1-.707 0l-1-1a.504.504 0 0 1 .707-.707l.647.647 2.313-2.313a.504.504 0 0 1 .707.707Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NoteIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M10.667 2.833c0 .827-.674 1.5-1.5 1.5H6.833a1.5 1.5 0 0 1-1.06-.44 1.5 1.5 0 0 1-.44-1.06c0-.827.674-1.5 1.5-1.5h2.334c.413 0 .786.167 1.06.44.273.274.44.647.44 1.06Z"
        fill="currentColor"
      />
      <path
        d="M12.553 3.353a1.66 1.66 0 0 0-.513-.3c-.193-.073-.387.08-.427.28a2.17 2.17 0 0 1-2.447 2 2.17 2.17 0 0 1-2.333 0 2.17 2.17 0 0 1-1.78-1.26c-.04-.2-.24-.36-.434-.28a2.66 2.66 0 0 0-1.286 2.407v6.5c0 2 1.193 2.667 2.667 2.667h5.333C12.14 14.667 13.333 14 13.333 12V5.5c0-1.087-.3-1.753-.78-2.147ZM5.333 8.167H8a.5.5 0 1 1 0 1H5.333a.5.5 0 1 1 0-1Zm5.334 3.666H5.333a.5.5 0 1 1 0-1h5.334a.5.5 0 1 1 0 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MessageQuestionIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M11.333 1.62H4.667c-2 0-3.334 1.333-3.334 3.333v4c0 2 1.334 3.333 3.334 3.333v1.42c0 .534.593.854 1.033.554L8.667 12.287h2.666c2 0 3.334-1.334 3.334-3.334v-4c0-2-1.334-3.333-3.334-3.333ZM8 9.733a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Zm.84-2.766c-.26.173-.34.287-.34.473v.14a.5.5 0 0 1-1 0v-.14c0-.774.567-1.154.78-1.294.247-.166.327-.28.327-.453a.67.67 0 0 0-.607-.607.67.67 0 0 0-.607.607.5.5 0 1 1-1 0 1.607 1.607 0 1 1 2.447 1.274Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect
        x="0.333333"
        y="0.333333"
        width="15.3333"
        height="15.3333"
        stroke="#1F1F1F"
        stroke-width="0.666667"
      />
      <path
        d="M5.25337 8.04665C5.25337 7.77331 5.48003 7.54665 5.75337 7.54665H9.4067V1.90665C9.40003 1.58665 9.1467 1.33331 8.8267 1.33331C4.90003 1.33331 2.16003 4.07331 2.16003 7.99998C2.16003 11.9266 4.90003 14.6666 8.8267 14.6666C9.14003 14.6666 9.40003 14.4133 9.40003 14.0933V8.53998H5.75337C5.47337 8.54665 5.25337 8.31998 5.25337 8.04665Z"
        fill="#777778"
      />
      <path
        d="M13.6934 7.69344L11.8 5.79344C11.6067 5.6001 11.2867 5.6001 11.0934 5.79344C10.9 5.98677 10.9 6.30677 11.0934 6.5001L12.1334 7.5401H9.40002V8.5401H12.1267L11.0867 9.5801C10.8934 9.77344 10.8934 10.0934 11.0867 10.2868C11.1867 10.3868 11.3134 10.4334 11.44 10.4334C11.5667 10.4334 11.6934 10.3868 11.7934 10.2868L13.6867 8.38677C13.8867 8.2001 13.8867 7.88677 13.6934 7.69344Z"
        fill="#777778"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function DaoPlanetImage({ dao }: { dao: string }) {
  const src = getPlanetImageForDao(dao);
  if (!src) {
    return (
      <span className="inline-flex w-5 h-5 rounded-full bg-amber-400/80 flex-shrink-0" />
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-5 h-5 rounded-full object-cover flex-shrink-0"
    />
  );
}

function statusColor(status: ProposalStatus): string {
  switch (status) {
    case "pending":
      return "text-[#00BAFF]";
    case "approved":
      return "text-[#D9A555]";
    case "executed":
      return "text-[#0ED4A8]";
    case "expired":
      return "text-[#FF3B52]";
    case "cancelled":
      return "text-gray-500";
    default:
      return "text-gray-400";
  }
}

function ActionCell({
  proposal,
  canCurrentUserApprove,
  onApprove,
  onExecute,
}: {
  proposal: Proposal;
  canCurrentUserApprove: boolean;
  onApprove: (p: Proposal) => Promise<void>;
  onExecute: (p: Proposal) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async (fn: (p: Proposal) => Promise<void>) => {
    setLoading(true);
    try {
      await fn(proposal);
    } finally {
      setLoading(false);
    }
  };

  if (
    proposal.status === "pending" &&
    !proposal.hasApproved &&
    canCurrentUserApprove
  ) {
    return (
      <button
        type="button"
        onClick={() => void handle(onApprove)}
        disabled={loading}
        className="msig-approve-btn"
      >
        {loading ? "..." : "Approve"}
      </button>
    );
  }
  if (proposal.status === "pending" && proposal.hasApproved) {
    return (
      <span className={`text-sm font-semibold ${statusColor("approved")}`}>
        Approved
      </span>
    );
  }
  if (proposal.status === "approved") {
    return (
      <button
        type="button"
        onClick={() => void handle(onExecute)}
        disabled={loading}
        className="msig-execute-btn"
      >
        {loading ? "..." : "Execute"}
      </button>
    );
  }
  return <span className="text-gray-500">-</span>;
}

/* ─── Sidebar Tab Config ─── */

const TABS = [
  { label: "All Proposals", icon: ClipboardTickIcon },
  { label: "My Submissions", icon: NoteIcon },
  { label: "How it Works", icon: MessageQuestionIcon },
] as const;

/* ─── Main Dashboard ─── */

interface MsigDashboardProps {
  session: Session;
  onLogout: () => void;
}

type CreateProposalToast = {
  type: "success" | "error";
  title: "Success" | "Failed";
  message: string;
};

export default function MsigDashboard({
  session,
  onLogout,
}: MsigDashboardProps) {
  const defaultPlanet = PLANET_OPTIONS[0] ?? null;
  const defaultDao =
    DAO_OPTIONS.find((opt) => opt.value === "syndicate") ?? DAO_OPTIONS[0] ?? null;
  const defaultDacId =
    defaultPlanet && defaultDao
      ? getDacId(String(defaultPlanet.value), defaultDao.value as "syndicate" | "union")
      : null;
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [selectedDacId, setSelectedDacId] =
    useState<string | null>(defaultDacId);
  const [selectedPlanetOption, setSelectedPlanetOption] =
    useState<Option | null>(defaultPlanet);
  const [selectedDaoTypeOption, setSelectedDaoTypeOption] =
    useState<Option | null>(defaultDao);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [createProposalToast, setCreateProposalToast] =
    useState<CreateProposalToast | null>(null);
  const [postCreateRefreshKey, setPostCreateRefreshKey] = useState(0);
  const currentUser = session.actor.toString();
  const isMySubmissions = activeTab === 1;
  const {
    proposals,
    loading,
    error,
    governanceError,
    currentCustodians,
    highThreshold,
    refetch,
  } = useMsigProposals(
    session,
    selectedDacId,
    isMySubmissions ? currentUser : null,
  );
  const canCurrentUserApprove = currentCustodians.includes(currentUser);

  const notifyTx = (type: "success" | "error", message: string) => {
    setCreateProposalToast({
      type,
      title: type === "success" ? "Success" : "Failed",
      message,
    });
  };

  const handleApprove = async (proposal: Proposal) => {
    const actor = session.actor.toString();
    try {
      await session.transact(
        {
          actions: [
            {
              account: MSIG_CONTRACT,
              name: "approve",
              data: {
                dac_id: proposal.dac_id,
                proposal_name: proposal.proposal_name,
                proposal_hash: null,
                level: { actor, permission: "active" },
              },
              authorization: [{ actor, permission: "active" }],
            },
          ],
        },
        { expireSeconds: 1200 },
      );
      notifyTx("success", `Approved "${proposal.title}".`);
      await refetch();
      setSelectedProposal(null);
    } catch (err) {
      notifyTx(
        "error",
        err instanceof Error ? err.message : "Failed to approve proposal",
      );
    }
  };

  const handleExecute = async (proposal: Proposal) => {
    const executer = session.actor.toString();
    try {
      await session.transact(
        {
          actions: [
            {
              account: MSIG_CONTRACT,
              name: "exec",
              data: {
                dac_id: proposal.dac_id,
                executer,
                proposal_name: proposal.proposal_name,
              },
              authorization: [{ actor: executer, permission: "active" }],
            },
          ],
        },
        { expireSeconds: 1200 },
      );
      notifyTx("success", `Executed "${proposal.title}".`);
      await refetch();
      setSelectedProposal(null);
    } catch (err) {
      notifyTx(
        "error",
        err instanceof Error ? err.message : "Failed to execute proposal",
      );
    }
  };

  const handleCancel = async (proposal: Proposal) => {
    const canceler = session.actor.toString();
    try {
      await session.transact(
        {
          actions: [
            {
              account: MSIG_CONTRACT,
              name: "cancel",
              data: {
                dac_id: proposal.dac_id,
                canceler,
                proposal_name: proposal.proposal_name,
              },
              authorization: [{ actor: canceler, permission: "active" }],
            },
          ],
        },
        { expireSeconds: 1200 },
      );
      notifyTx("success", `Cancelled "${proposal.title}".`);
      await refetch();
      setSelectedProposal(null);
    } catch (err) {
      notifyTx(
        "error",
        err instanceof Error ? err.message : "Failed to cancel proposal",
      );
    }
  };

  const handleCleanup = async (proposal: Proposal) => {
    const actor = session.actor.toString();
    try {
      await session.transact(
        {
          actions: [
            {
              account: MSIG_CONTRACT,
              name: "cleanup",
              data: {
                dac_id: proposal.dac_id,
                proposal_name: proposal.proposal_name,
              },
              authorization: [{ actor, permission: "active" }],
            },
          ],
        },
        { expireSeconds: 1200 },
      );
      notifyTx("success", `Cleaned up "${proposal.title}" from MSIG tables.`);
      await refetch();
      setSelectedProposal(null);
    } catch (err) {
      notifyTx(
        "error",
        err instanceof Error ? err.message : "Failed to cleanup proposal",
      );
    }
  };

  const filteredProposals = useMemo(() => {
    if (!search.trim()) return proposals;
    const q = search.toLowerCase();
    return proposals.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.createdBy.toLowerCase().includes(q) ||
        p.dao.toLowerCase().includes(q),
    );
  }, [proposals, search]);

  const total = filteredProposals.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    if (!createProposalToast) return;
    const timeout = window.setTimeout(() => {
      setCreateProposalToast(null);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [createProposalToast]);

  const handleCreateProposalNotify = (
    type: "success" | "error",
    message: string,
  ) => {
    setCreateProposalToast({
      type,
      title: type === "success" ? "Success" : "Failed",
      message,
    });
  };

  const mapDacIdToSelection = (dacId: string): {
    planet: Option | null;
    dao: Option | null;
  } => {
    const normalizedDacId = dacId.toLowerCase();
    const isUnion = normalizedDacId.endsWith("unn");
    const planetKey =
      normalizedDacId === "neriunn"
        ? "nerix"
        : isUnion
          ? normalizedDacId.slice(0, -3)
          : normalizedDacId;
    const planet =
      PLANET_OPTIONS.find((opt) => opt.value === planetKey) ??
      PLANET_OPTIONS[0] ??
      null;
    const dao =
      DAO_OPTIONS.find(
        (opt) => opt.value === (isUnion ? "union" : "syndicate"),
      ) ??
      (isUnion
        ? ({ value: "union", label: "Union" } as Option)
        : ({ value: "syndicate", label: "Syndicate" } as Option));
    return { planet, dao };
  };

  const handleCreateProposalSuccess = (dacId: string) => {
    setActiveTab(1);
    setSelectedDacId(dacId);
    const selection = mapDacIdToSelection(dacId);
    setSelectedPlanetOption(selection.planet);
    setSelectedDaoTypeOption(selection.dao);
    setPage(1);
    setPostCreateRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (postCreateRefreshKey === 0 || !selectedDacId) return;

    void refetch();
    const timeout = window.setTimeout(() => {
      void refetch();
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [postCreateRefreshKey, selectedDacId, refetch]);

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const paginatedProposals = filteredProposals.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="h-screen bg-[#1F1F1F] p-3 grid grid-cols-[240px_1fr] gap-3 text-white font-titillium overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="grid grid-rows-2 gap-3 min-h-0">
        {/* Tab Navigation + Wallet (top 50%) */}
        <div className="bg-black rounded-[12px] p-2.5 flex flex-col min-h-0">
          <div className="flex flex-col gap-1" role="tablist">
            {TABS.map((tab, idx) => {
              const isActive = activeTab === idx && !showCreateProposal;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(idx);
                    if (showCreateProposal) setShowCreateProposal(false);
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[6px] transition-all ${
                    isActive
                      ? "tab-selected-gradient text-white text-[14px] font-bold leading-[160%] font-['Titillium_Web']"
                      : "text-[#B9B9B9] hover:bg-white/5 text-[14px] font-normal leading-[160%] font-['Titillium_Web']"
                  }`}
                >
                  <Icon
                    className={isActive ? "text-white" : "text-[#B9B9B9]"}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-3 px-2 py-2 flex items-center gap-2.5 rounded-[8px] bg-[#1F1F1F]">
            <WalletProviderIcon
              walletPluginId={
                (session as { walletPlugin?: { id?: string } }).walletPlugin?.id
              }
            />
            <span className="text-[13px] text-white/90 font-mono truncate flex-1">
              {String(session.actor)}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/10 transition-colors text-[#B9B9B9] hover:text-white"
              aria-label="Logout"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>

        {/* Promo Card (bottom 50%) */}
        <div className="bg-black rounded-[12px] flex flex-col overflow-hidden min-h-0">
          <img src="/assets/promo-bg.png" alt="" className="w-full flex-1 object-cover" />
          <div className="flex flex-col items-center justify-center px-4 py-5 gap-3 flex-shrink-0">
            <img
              src="/assets/logo/alienworlds-db-logo_full_color.svg"
              alt="Alien Worlds"
              className="w-[90px]"
            />
            <p className="text-[11px] text-[#8F8E8E] text-center leading-relaxed">
              The biggest metaverse in web3
              <br />
              is awaiting for you
            </p>
          </div>
        </div>
      </aside>

      {/* ── Right Main Area ── */}
      <div className="flex flex-col min-h-0 gap-3">
        {showCreateProposal ? (
          <CreateProposalView
            onCancel={() => setShowCreateProposal(false)}
            onSuccess={handleCreateProposalSuccess}
            onNotify={handleCreateProposalNotify}
            selectedDacId={selectedDacId ?? "eyeke"}
            planetIcons={PLANET_ICONS}
            planetImages={PLANET_IMAGES}
            planetImagesLandscape={PLANET_IMAGES_LANDSCAPE}
            planetImagesDetails={PLANET_IMAGES_DETAIL}
            session={session}
          />
        ) : activeTab === 2 ? (
          /* How it Works tab - placeholder */
          <main className="bg-black rounded-[12px] flex flex-col min-h-0 overflow-hidden flex-1 items-center justify-center px-6 py-16">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <MessageQuestionIcon className="w-8 h-8 text-amber-500/80" />
              </div>
              <h2 className="text-xl font-semibold text-white">How it Works</h2>
              <p className="text-[#B9B9B9] text-sm leading-relaxed">
                This section is currently under development. Documentation and
                guides on how to create, approve, and execute multisig proposals
                will be available here soon.
              </p>
              <span className="text-xs text-white/40">Work in progress</span>
            </div>
          </main>
        ) : (
          <>
            {/* Table Card */}
            <main className="bg-black rounded-[12px] flex flex-col min-h-0 overflow-hidden flex-1">
              {/* Top Bar: DAO Dropdown + Search + Create Proposal */}
              <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 max-w-sm dashboard-dao-select-wrapper">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <Select
                          options={PLANET_OPTIONS}
                          value={selectedPlanetOption}
                          onChange={(opt) => {
                            const planet = opt as Option | null;
                            setSelectedPlanetOption(planet);
                            const daoType = selectedDaoTypeOption?.value as
                              | "syndicate"
                              | "union"
                              | undefined;
                            setSelectedDacId(
                              planet?.value && daoType
                                ? getDacId(String(planet.value), daoType)
                                : null,
                            );
                            setPage(1);
                          }}
                          formatOptionLabel={(opt) =>
                            formatPlanetOption(opt, PLANET_ICONS)
                          }
                          components={{
                            SingleValue: ({ data, ...props }) => (
                              <components.SingleValue {...props} data={data}>
                                {data
                                  ? formatPlanetOption(data, PLANET_ICONS)
                                  : null}
                              </components.SingleValue>
                            ),
                          }}
                          placeholder="Select Planet"
                          classNamePrefix="dashboard-dao-select"
                          styles={{
                            ...DROPDOWN_STYLES,
                            control: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.control(base),
                              minHeight: 40,
                              height: 40,
                            }),
                            valueContainer: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.valueContainer(base),
                              overflow: "visible",
                              padding: "0 8px",
                            }),
                            singleValue: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.singleValue(base),
                              overflow: "visible",
                              maxWidth: "none",
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            input: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.input(base),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            placeholder: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.placeholder(base),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            option: (
                              base: Record<string, unknown>,
                              state: { isFocused?: boolean },
                            ) => ({
                              ...DROPDOWN_STYLES.option(base, state),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            menuPortal: (base: Record<string, unknown>) => ({
                              ...base,
                              zIndex: 99999,
                            }),
                          }}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                        />
                      </div>
                      <div className="w-[160px] flex-shrink-0">
                        <Select
                          options={DAO_OPTIONS}
                          value={selectedDaoTypeOption}
                          onChange={(opt) => {
                            const dao = opt as Option | null;
                            setSelectedDaoTypeOption(dao);
                            const planet = selectedPlanetOption?.value;
                            const daoType = dao?.value as
                              | "syndicate"
                              | "union"
                              | undefined;
                            setSelectedDacId(
                              planet && daoType
                                ? getDacId(String(planet), daoType)
                                : null,
                            );
                            setPage(1);
                          }}
                          placeholder="Select DAO"
                          classNamePrefix="dashboard-dao-select"
                          styles={{
                            ...DROPDOWN_STYLES,
                            control: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.control(base),
                              minHeight: 40,
                              height: 40,
                            }),
                            valueContainer: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.valueContainer(base),
                              padding: "0 8px",
                            }),
                            singleValue: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.singleValue(base),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            input: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.input(base),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            placeholder: (base: Record<string, unknown>) => ({
                              ...DROPDOWN_STYLES.placeholder(base),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            option: (
                              base: Record<string, unknown>,
                              state: { isFocused?: boolean },
                            ) => ({
                              ...DROPDOWN_STYLES.option(base, state),
                              fontSize: "0.875rem",
                              fontFamily: "inherit",
                            }),
                            menuPortal: (base: Record<string, unknown>) => ({
                              ...base,
                              zIndex: 99999,
                            }),
                          }}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      <SearchIcon />
                    </span>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateProposal(true)}
                  disabled={!selectedDacId}
                  className="login-gradient-btn"
                >
                  Create Proposal
                </button>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto px-5 pb-3">
                {error && (
                  <div className="my-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between gap-4">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {selectedDacId && governanceError && (
                  <div className="my-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                    Governance data is unavailable for this DAO. Approve is
                    disabled until candidate/custodian data can be loaded.
                  </div>
                )}
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="font-titillium text-left text-[13px] font-bold text-white/60 bg-[#1F1F1F]">
                      <th className="px-4 py-3 rounded-l-lg">#</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Created By</th>
                      <th className="px-4 py-3">Expire Date</th>
                      <th className="px-4 py-3">DAO</th>
                      <th className="px-4 py-3">Approvals</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-titillium text-[12px] font-normal">
                    {!selectedDacId ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-white/60"
                        >
                          Select a DAO to view proposals
                        </td>
                      </tr>
                    ) : loading ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-white/60"
                        >
                          Loading proposals...
                        </td>
                      </tr>
                    ) : paginatedProposals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-white/60"
                        >
                          No proposals found.
                        </td>
                      </tr>
                    ) : (
                      paginatedProposals.map((proposal, idx) => (
                        <tr
                          key={`${proposal.dac_id}::${proposal.proposal_name}`}
                          className="border-b border-white/5 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                          onClick={() => setSelectedProposal(proposal)}
                        >
                          <td className="px-4 py-3.5 text-white/90">
                            {isMySubmissions ? start + idx : proposal.id}
                          </td>
                          <td className="px-4 py-3.5 text-white/90">
                            {proposal.title}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-white/80">
                            {proposal.createdBy}
                          </td>
                          <td className="px-4 py-3.5 text-white/80">
                            {proposal.expireDate}
                          </td>
                          <td className="px-4 py-3.5 text-white/90">
                            <span className="flex items-center gap-1.5">
                              <DaoPlanetImage dao={proposal.dao} />
                              {proposal.dao}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-white/90">
                            <span
                              className={
                                proposal.approvalAccountIds.length > 0
                                  ? "cursor-help"
                                  : undefined
                              }
                              title={
                                proposal.approvalAccountIds.length > 0
                                  ? proposal.approvalAccountIds.join(", ")
                                  : undefined
                              }
                            >
                              {proposal.approvals}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3.5 capitalize ${statusColor(
                              proposal.status,
                            )}`}
                          >
                            {proposal.status}
                          </td>
                          <td
                            className="px-4 py-3.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ActionCell
                              proposal={proposal}
                              canCurrentUserApprove={canCurrentUserApprove}
                              onApprove={handleApprove}
                              onExecute={handleExecute}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </main>

            {/* Pagination -- outside the table card, on the #1F1F1F background */}
            <div className="flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md text-[#777778] hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="First page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md text-[#777778] hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-md text-[13px] font-medium transition-colors ${
                        page === p
                          ? " text-white"
                          : "text-[#777778] hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-md text-[#B9B9B9] hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-md text-[#B9B9B9] hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Last page"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm6 0a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-[13px] text-[#B9B9B9] font-titillium">
                Results: {total === 0 ? "0" : `${start}-${end}`} of {total}
              </p>
            </div>
          </>
        )}
      </div>
      <ProposalDetailModal
        isOpen={!!selectedProposal}
        onClose={() => setSelectedProposal(null)}
        proposal={selectedProposal}
        session={session}
        planetImagesLandscape={PLANET_IMAGES_DETAIL}
        planetIcons={PLANET_ICONS}
        canCurrentUserApprove={canCurrentUserApprove}
        highThreshold={highThreshold}
        onApprove={handleApprove}
        onExecute={handleExecute}
        onCancel={handleCancel}
        onCleanup={handleCleanup}
      />
      {createProposalToast && (
        <div className="fixed right-6 bottom-6 z-[70]">
          <div
            className="inline-flex"
            style={{
              padding: "12px 16px",
              alignItems: "flex-start",
              gap: "12px",
              borderRadius: "12px",
              border:
                createProposalToast.type === "success"
                  ? "1px solid var(--Functional-Success-800, #008773)"
                  : "1px solid var(--Functional-Error-800, #B42318)",
              background:
                createProposalToast.type === "success"
                  ? "rgba(14, 212, 168, 0.30)"
                  : "rgba(255, 59, 82, 0.30)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex flex-col">
              <span
                style={{
                  color: "var(--Neutral-White, #FFF)",
                  fontFamily: '"Titillium Web"',
                  fontSize: "18px",
                  fontStyle: "normal",
                  fontWeight: 700,
                  lineHeight: "160%",
                }}
              >
                {createProposalToast.title}
              </span>
              <span
                style={{
                  color: "var(--Neutral-White, #FFF)",
                  fontFamily: '"Titillium Web"',
                  fontSize: "18px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "160%",
                }}
              >
                {createProposalToast.message}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
