import { useState, useEffect, useMemo } from "react";
import type { Session } from "@wharfkit/session";
import { APIClient, FetchProvider } from "@wharfkit/antelope";
import { Chains } from "@wharfkit/session";
import {
  Button,
  BUTTON_SIZE,
  BUTTON_VARIANT,
  Dropdown,
  Option,
} from "@alien-worlds/uikit";
import { Search2Icon } from "@alien-worlds/icons";

import alienWorldsLogo from "@/assets/logo/alienworlds-db-logo_full_color.svg";
import { getKnownContractsForChain } from "@/config/contracts";
import {
  fetchContractAbi,
  getActionNamesFromAbi,
  type ContractAbi,
} from "@/hooks/useContractAbi";
import { useRecentContracts } from "@/hooks/useRecentContracts";
import { getActionFields, type ActionField } from "@/utils/abiForm";
import { getInputKind, validateField } from "@/utils/abiTypeMapping";
import {
  MSIG_CONTRACT,
  generateRandomProposalName,
  getDacId,
  getProposalExpiration,
  type BasicProposal,
} from "@/types/msig";
import {
  serializeActionForProposal,
  coerceActionData,
} from "@/utils/serializeAction";
import { fetchRequestedApproversByRank } from "@/services/msigApi";

const inputClassName =
  "w-full h-10 px-3 rounded-lg border bg-[#100F10] text-white placeholder:text-white/60 font-titillium text-sm outline-none transition-colors border-white/10 hover:border-white/20 focus:border-[rgba(217,165,85,0.5)]";

function ActionFieldInput({
  field,
  value,
  error,
  onValueChange,
  onBlur,
}: {
  field: ActionField;
  value: unknown;
  error: string;
  onValueChange: (v: unknown) => void;
  onBlur: () => void;
}) {
  const kind = getInputKind(field.type);
  const label = field.name + (field.isArray ? " (comma-separated)" : "");

  if (kind === "checkbox") {
    const checked = value === true || value === "true" || value === "1";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onValueChange(e.target.checked)}
            onBlur={onBlur}
            className="w-4 h-4 rounded border-white/20 bg-[#100F10] text-[#D9A555] focus:ring-[#D9A555]"
          />
          <span className="text-sm text-white/80 font-titillium">Yes</span>
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  if (kind === "date") {
    const str = value != null ? String(value) : "";
    const num = Number(str);
    const dateVal =
      str !== "" && !Number.isNaN(num)
        ? new Date(num * 1000).toISOString().slice(0, 16)
        : "";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <input
          type="datetime-local"
          value={dateVal}
          onChange={(e) => {
            const t = e.target.value
              ? Math.floor(new Date(e.target.value).getTime() / 1000)
              : "";
            onValueChange(t);
          }}
          onBlur={onBlur}
          className={`${inputClassName} ${error ? "border-red-400" : ""}`}
        />
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  if (kind === "number") {
    const str = value != null ? String(value) : "";
    return (
      <div>
        <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
          {label}
        </label>
        <input
          type="number"
          value={str}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={onBlur}
          placeholder={field.type}
          className={`${inputClassName} ${error ? "border-red-400" : ""}`}
        />
        {error && (
          <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
        )}
      </div>
    );
  }

  const str = value != null ? String(value) : "";
  return (
    <div>
      <label className="block text-sm font-medium text-white/90 mb-1.5 font-titillium">
        {label}
      </label>
      <input
        type="text"
        value={str}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        placeholder={
          field.isArray
            ? "e.g. a, b, c"
            : field.type === "asset"
            ? "e.g. 12.1234 TLM"
            : field.type
        }
        className={`${inputClassName} ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-400 font-titillium">{error}</p>
      )}
    </div>
  );
}

const PLANET_NAMES = [
  "eyeke",
  "kavian",
  "magor",
  "naron",
  "nerix",
  "veles",
  "testa", // TEMP: testing planet (uses eyeke images)
] as const;

const PLANET_OPTIONS: Option[] = PLANET_NAMES.map((name) => ({
  value: name,
  label: name.charAt(0).toUpperCase() + name.slice(1),
}));

const DAO_OPTIONS: Option[] = [
  { value: "syndicate", label: "Syndicate" },
  { value: "union", label: "Union" },
];

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

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  planetImages: Record<string, string>;
  session?: Session;
  onSuccess?: () => void;
}

const DROPDOWN_STYLES = {
  control: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#100F10",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    height: 48,
    minHeight: 48,
    "&:hover": {
      borderColor: "rgba(217,165,85,0.5)",
    },
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "transparent",
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    color: "white",
    backgroundColor: "transparent",
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: "white",
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgba(255,255,255,0.6)",
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#100F10",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
  }),
  option: (base: Record<string, unknown>, state: { isFocused?: boolean }) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(255,255,255,0.1)" : "transparent",
    color: "white",
  }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgba(255,255,255,0.8)",
  }),
  indicatorSeparator: () => ({ display: "none" }),
};

export default function CreateProposalModal({
  isOpen,
  onClose,
  planetImages,
  session,
  onSuccess,
}: CreateProposalModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlanet, setSelectedPlanet] = useState<Option | null>(
    PLANET_OPTIONS[0],
  );
  const [selectedDao, setSelectedDao] = useState<Option | null>(DAO_OPTIONS[1]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Step 2: contract search and actions
  const [contractSearch, setContractSearch] = useState("");
  const [contractName, setContractName] = useState("");
  const [contractAbi, setContractAbi] = useState<ContractAbi>(null);
  const [contractActions, setContractActions] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [isLoadingAbi, setIsLoadingAbi] = useState(false);
  const [abiError, setAbiError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [actionFormValues, setActionFormValues] = useState<
    Record<string, unknown>
  >({});
  const [actionFormErrors, setActionFormErrors] = useState<
    Record<string, string>
  >({});

  const apiClient = useMemo(() => getApiClient(session), [session]);
  const chainId = session?.chain?.id
    ? String(session.chain.id)
    : String(Chains.WAX.id);
  const { recent: recentContracts, addRecent } = useRecentContracts(chainId);
  const knownContracts = useMemo(
    () => getKnownContractsForChain(chainId),
    [chainId],
  );

  // Smart suggestions: recent first, then curated. Filter by search. Dedupe.
  const { recentFiltered, knownFiltered } = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    const matches = (name: string) => !q || name.toLowerCase().includes(q);

    const recent = recentContracts.filter(matches);
    const known = knownContracts.filter(
      (c) => matches(c) && !recentContracts.includes(c),
    );

    return { recentFiltered: recent, knownFiltered: known };
  }, [contractSearch, recentContracts, knownContracts]);

  const hasSuggestions = recentFiltered.length > 0 || knownFiltered.length > 0;

  const loadContractAbi = async (accountName: string) => {
    const name = accountName.trim();
    if (!name) return;
    setIsLoadingAbi(true);
    setAbiError("");
    setShowSuggestions(false);
    try {
      const abi = await fetchContractAbi(apiClient, name);
      addRecent(name);
      setContractName(name);
      setContractAbi(abi);
      setContractActions(getActionNamesFromAbi(abi));
      setSelectedAction("");
      setActionFormValues({});
      setActionFormErrors({});
    } catch (err) {
      setAbiError(
        err instanceof Error ? err.message : "Failed to load contract",
      );
      setContractName("");
      setContractAbi(null);
      setContractActions([]);
      setSelectedAction("");
      setActionFormValues({});
      setActionFormErrors({});
    } finally {
      setIsLoadingAbi(false);
    }
  };

  const handleContractSelect = (name: string) => {
    setContractSearch(name);
    setShowSuggestions(false);
    loadContractAbi(name);
  };

  const handleContractSearchSubmit = () => {
    const name = contractSearch.trim();
    if (name) loadContractAbi(name);
  };

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setTitle("");
      setDescription("");
      setMemo("");
      setSubmitError("");
      setContractSearch("");
      setContractName("");
      setContractAbi(null);
      setContractActions([]);
      setSelectedAction("");
      setAbiError("");
      setActionFormValues({});
      setActionFormErrors({});
    }
  }, [isOpen]);

  // Reset form when action changes
  useEffect(() => {
    if (selectedAction) {
      setActionFormValues({});
      setActionFormErrors({});
    }
  }, [selectedAction]);

  const actionFields = useMemo(() => {
    if (!contractAbi || !selectedAction) return [];
    return getActionFields(contractAbi, selectedAction);
  }, [contractAbi, selectedAction]);

  const setFieldValue = (fieldName: string, value: unknown) => {
    setActionFormValues((prev) => ({ ...prev, [fieldName]: value }));
    setActionFormErrors((prev) => ({ ...prev, [fieldName]: "" }));
  };

  const validateFieldBlur = (
    fieldName: string,
    abiType: string,
    value: unknown,
  ) => {
    const err = validateField(value, abiType);
    setActionFormErrors((prev) => ({
      ...prev,
      [fieldName]: err ?? "",
    }));
  };

  const handleCreate = async () => {
    setSubmitError("");
    if (!session) {
      setSubmitError("Wallet not connected");
      return;
    }
    const proposer = session.actor.toString();
    const planetVal = selectedPlanet?.value;
    const daoVal = selectedDao?.value;
    if (!planetVal || !daoVal) {
      setSubmitError("Select planet and DAO");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Title is required");
      return;
    }
    if (!description.trim()) {
      setSubmitError("Description is required");
      return;
    }
    if (!contractName || !selectedAction || !contractAbi) {
      setSubmitError("Select a contract and action");
      return;
    }

    const hasActionFields = actionFields.length > 0;
    if (hasActionFields) {
      const missing = actionFields.filter(
        (f) =>
          actionFormValues[f.name] == null ||
          String(actionFormValues[f.name]).trim() === "",
      );
      const invalid = actionFields.filter((f) => actionFormErrors[f.name]);
      if (missing.length > 0) {
        setSubmitError(
          `Fill required fields: ${missing.map((f) => f.name).join(", ")}`,
        );
        return;
      }
      if (invalid.length > 0) {
        setSubmitError("Fix validation errors in the action form");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const dac_id = getDacId(planetVal, daoVal as "syndicate" | "union");
      const proposal_name = generateRandomProposalName();
      const txAuthorization = [{ actor: proposer, permission: "active" as const }];
      const requested = await fetchRequestedApproversByRank(
        session,
        dac_id,
        proposer,
      );
      if (requested.length === 0) {
        throw new Error("No ranked candidates were found for this DAO.");
      }

      const data = hasActionFields
        ? coerceActionData(actionFormValues, actionFields)
        : {};
      const serializedAction = serializeActionForProposal(
        contractName,
        selectedAction,
        txAuthorization,
        data,
        contractAbi,
      );

      const basicProposal: BasicProposal = {
        proposer,
        proposal_name,
        requested,
        dac_id,
        metadata: memo.trim()
          ? [
              { key: "title", value: title.trim() },
              { key: "description", value: description.trim() },
              { key: "memo", value: memo.trim() },
            ]
          : [
              { key: "title", value: title.trim() },
              { key: "description", value: description.trim() },
            ],
        trx: {
          expiration: getProposalExpiration(7),
          context_free_actions: [],
          delay_sec: "0",
          max_cpu_usage_ms: 0,
          max_net_usage_words: "0",
          ref_block_num: 0,
          ref_block_prefix: 0,
          actions: [serializedAction],
          transaction_extensions: [],
        },
      };

      const proposeAction = {
        account: MSIG_CONTRACT,
        name: "propose",
        data: basicProposal,
        authorization: txAuthorization,
      };

      await session.transact(
        { actions: [proposeAction] },
        { expireSeconds: 1200 },
      );

      onSuccess?.();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatPlanetOption = (option: Option) => (
    <div className="flex items-center gap-2">
      {planetImages[option.value] ? (
        <img
          src={planetImages[option.value]}
          alt=""
          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-amber-400/80 flex-shrink-0 block" />
      )}
      <span>{option.label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative w-[90vw] h-[90vh] max-w-[90vw] max-h-[90vh] rounded-2xl border border-white/10 bg-[#100F10] overflow-hidden shadow-2xl flex flex-col"
        role="dialog"
        aria-modal
        aria-labelledby="create-proposal-title"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-auto">
          {/* Left Column */}
          <div className="px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8 flex flex-col">
            <h2
              id="create-proposal-title"
              className="text-2xl font-medium text-white font-orbitron mb-2"
            >
              {step === 1 ? "Select DAO" : "Add Actions"}
            </h2>
            <p className="text-sm text-white/80 mb-6 font-titillium">
              Trilium (token symbol TLM) is the Alien Worlds in-game currency,
              designed for gameplay and governance across the metaverse.
            </p>

            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Proposal title"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this proposal does"
                    rows={3}
                    className={`${inputClassName} min-h-[80px] resize-y`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Memo (optional)
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Additional note"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Select Planet
                  </label>
                  <Dropdown
                    variant="simple"
                    size="lg"
                    options={PLANET_OPTIONS}
                    value={selectedPlanet}
                    onChange={(opt) => setSelectedPlanet(opt as Option | null)}
                    formatOptionLabel={formatPlanetOption}
                    placeholder="Select planet..."
                    classNamePrefix="create-proposal-select"
                    styles={DROPDOWN_STYLES}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Select DAO
                  </label>
                  <Dropdown
                    variant="simple"
                    size="lg"
                    options={DAO_OPTIONS}
                    value={selectedDao}
                    onChange={(opt) => setSelectedDao(opt as Option | null)}
                    placeholder="Select DAO..."
                    classNamePrefix="create-proposal-select"
                    styles={DROPDOWN_STYLES}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-white/90 mb-2 font-titillium">
                    Search Contract
                  </label>
                  <div className="relative">
                    <div
                      className={`flex items-center gap-3 h-12 px-4 rounded-lg border bg-[#100F10] transition-colors ${
                        abiError
                          ? "border-red-400"
                          : "border-white/10 hover:border-[rgba(217,165,85,0.5)] focus-within:border-[rgba(217,165,85,0.5)]"
                      } ${isLoadingAbi ? "opacity-70" : ""}`}
                    >
                      <Search2Icon
                        boxSize={20}
                        color="rgba(255,255,255,0.6)"
                        className="flex-shrink-0"
                      />
                      <input
                        type="text"
                        placeholder="Contract name"
                        value={contractSearch}
                        onChange={(e) => {
                          setContractSearch(e.target.value);
                          setShowSuggestions(true);
                          setAbiError("");
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleContractSearchSubmit();
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowSuggestions(false), 150);
                        }}
                        disabled={isLoadingAbi}
                        className="flex-1 min-w-0 bg-transparent text-white placeholder:text-white/60 font-titillium text-base outline-none"
                      />
                    </div>
                    {showSuggestions && hasSuggestions && (
                      <div className="absolute z-10 w-full mt-2 rounded-lg border border-white/10 bg-[#100F10] shadow-lg min-h-[80px] max-h-72 overflow-auto py-1">
                        {recentFiltered.length > 0 && (
                          <>
                            <div className="px-4 py-2 text-xs font-medium text-white/50 font-orbitron uppercase tracking-wider">
                              Recently used
                            </div>
                            {recentFiltered.map((name) => (
                              <button
                                key={name}
                                type="button"
                                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 font-titillium transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleContractSelect(name);
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
                                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 font-titillium transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleContractSelect(name);
                                }}
                              >
                                {name}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {abiError && (
                    <p className="mt-1 text-sm text-red-400 font-titillium">
                      {abiError}
                    </p>
                  )}
                  {isLoadingAbi && (
                    <p className="mt-1 text-sm text-white/60 font-titillium">
                      Loading contract...
                    </p>
                  )}
                </div>

                {contractActions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-white font-orbitron mb-3">
                      Select contract action
                    </h3>
                    <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto overflow-x-hidden pr-1">
                      {contractActions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setSelectedAction(action)}
                          className={`px-4 py-2.5 rounded-lg border font-titillium text-sm font-medium transition-colors capitalize ${
                            selectedAction === action
                              ? "bg-white text-[#100F10] border-white"
                              : "bg-[#100F10] text-white border-white/20 hover:border-white/40"
                          }`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 pt-6">
              {step === 1 ? (
                <>
                  <Button
                    size={BUTTON_SIZE.lg}
                    variant={BUTTON_VARIANT.tertiary}
                    onClick={onClose}
                    fontSize={18}
                    minWidth="192px"
                  >
                    Cancel
                  </Button>
                  <Button
                    size={BUTTON_SIZE.lg}
                    variant={BUTTON_VARIANT.primary}
                    onClick={() => setStep(2)}
                    fontSize={18}
                    minWidth="192px"
                    disabled={!title.trim() || !description.trim()}
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
                  {submitError && (
                    <p className="text-sm text-red-400 font-titillium">
                      {submitError}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      size={BUTTON_SIZE.lg}
                      variant={BUTTON_VARIANT.tertiary}
                      onClick={() => setStep(1)}
                      fontSize={18}
                      minWidth="192px"
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button
                      size={BUTTON_SIZE.lg}
                      variant={BUTTON_VARIANT.primary}
                      onClick={handleCreate}
                      fontSize={18}
                      minWidth="192px"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Create"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="relative p-6 md:p-8 flex flex-col min-h-[320px]">
            {/* Step indicator - top right */}
            <div className="absolute top-6 right-6 md:top-8 md:right-8 text-right">
              <div className="flex gap-1 mt-1">
                <div
                  className={`h-1 rounded-full w-8 ${
                    step === 1 ? "bg-[#D9A555]" : "bg-white/30"
                  }`}
                  aria-hidden
                />
                <div
                  className={`h-1 rounded-full w-8 ${
                    step === 2 ? "bg-[#D9A555]" : "bg-white/30"
                  }`}
                  aria-hidden
                />
              </div>
              <span className="text-sm text-white/80 font-titillium">
                {step} of 2
              </span>
            </div>

            {/* Placeholder area / Action form */}
            <div
              className="flex-1 rounded-xl border border-dashed border-white/20 mt-12 min-h-[200px] flex flex-col p-6 overflow-hidden"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
                  linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%),
                  linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)
                `,
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
            >
              {step === 2 &&
                (selectedAction && contractAbi ? (
                  actionFields.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-white/60 font-titillium">
                        No parameters for this action.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full min-h-0">
                      <h3 className="text-lg font-medium text-white font-orbitron mb-3 flex-shrink-0">
                        {selectedAction}
                      </h3>
                      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                        {actionFields.map((field) => (
                          <ActionFieldInput
                            key={field.name}
                            field={field}
                            value={actionFormValues[field.name]}
                            error={actionFormErrors[field.name]}
                            onValueChange={(v) => setFieldValue(field.name, v)}
                            onBlur={() =>
                              validateFieldBlur(
                                field.name,
                                field.type,
                                actionFormValues[field.name],
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h3 className="text-xl font-medium text-white font-orbitron mb-3">
                      {contractName ? "Select an action" : "Enter the Data"}
                    </h3>
                    <p className="text-sm text-white/80 font-titillium max-w-md">
                      {contractName
                        ? "Choose an action from the grid on the left."
                        : "Firstly find and select contract. Then choose action. The form will appear after selecting the action in the contract."}
                    </p>
                  </div>
                ))}
            </div>

            {/* Logo - bottom right */}
            <div className="absolute bottom-6 mr-4 mb-4 right-6 md:bottom-8 md:right-8">
              <img
                src={alienWorldsLogo}
                alt="Alien Worlds"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
