import { useState, useEffect, useMemo } from "react";
import type { Session } from "@wharfkit/session";
import type { Option } from "@alien-worlds/uikit";
import { Chains } from "@wharfkit/session";

import { getKnownContractsForChain } from "@/config/contracts";
import {
  fetchContractAbi,
  getActionNamesFromAbi,
} from "@/hooks/useContractAbi";
import { useRecentContracts } from "@/hooks/useRecentContracts";
import { getActionFields } from "@/utils/abiForm";
import { validateField } from "@/utils/abiTypeMapping";
import {
  MSIG_CONTRACT,
  getDacProposer,
  generateRandomProposalName,
  getDacId,
  getProposalExpiration,
  type BasicProposal,
} from "@/types/msig";
import {
  serializeActionForProposal,
  coerceActionData,
} from "@/utils/serializeAction";

import {
  getApiClient,
  DAO_OPTIONS,
  PLANET_OPTIONS,
} from "./createProposal/createProposalConstants";
import { CreateProposalStep1 } from "./createProposal/CreateProposalStep1";
import { CreateProposalStep2 } from "./createProposal/CreateProposalStep2";
import { CreateProposalStep3 } from "./createProposal/CreateProposalStep3";
import { createEmptyAction, type ProposalAction } from "./createProposal/types";

export interface CreateProposalViewProps {
  onCancel: () => void;
  onSuccess?: (dacId: string) => void;
  onNotify?: (type: "success" | "error", message: string) => void;
  selectedDacId: string;
  planetImages: Record<string, string>;
  planetImagesLandscape?: Record<string, string>;
  planetImagesDetails?: Record<string, string>;
  planetIcons: Record<string, string>;
  session?: Session;
}

export default function CreateProposalView({
  onCancel,
  onSuccess,
  onNotify,
  selectedDacId,
  planetImages,
  planetImagesLandscape,
  planetImagesDetails,
  planetIcons,
  session,
}: CreateProposalViewProps) {
  const mapDacIdToSelection = (
    dacId: string,
  ): {
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
      PLANET_OPTIONS[0];
    return {
      planet,
      dao: {
        value: isUnion ? "union" : "syndicate",
        label: isUnion ? "Union" : "Syndicate",
      },
    };
  };
  const initialSelection = useMemo(
    () => mapDacIdToSelection(selectedDacId),
    [selectedDacId],
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanet, setSelectedPlanet] = useState<Option | null>(
    initialSelection.planet,
  );
  const [previousPlanet, setPreviousPlanet] = useState<string>(
    initialSelection.planet?.value ?? PLANET_OPTIONS[0]?.value ?? "eyeke",
  );
  const [selectedDao, setSelectedDao] = useState<Option | null>(
    initialSelection.dao,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [actions, setActions] = useState<ProposalAction[]>(() => [
    createEmptyAction(),
  ]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [isLoadingAbi, setIsLoadingAbi] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [suggestionsOpenForActionId, setSuggestionsOpenForActionId] = useState<
    string | null
  >(null);

  const apiClient = useMemo(() => getApiClient(session), [session]);
  const chainId = session?.chain?.id
    ? String(session.chain.id)
    : String(Chains.WAX.id);
  const { recent: recentContracts, addRecent } = useRecentContracts(chainId);
  const knownContracts = useMemo(
    () => getKnownContractsForChain(chainId),
    [chainId],
  );

  // Keep step-1 defaults in sync with the dashboard selection.
  useEffect(() => {
    const next = mapDacIdToSelection(selectedDacId);
    setSelectedPlanet(next.planet);
    setSelectedDao(
      DAO_OPTIONS.find((opt) => opt.value === next.dao?.value) ?? next.dao,
    );
    setPreviousPlanet((prev) => prev || (next.planet?.value ?? "eyeke"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDacId]);

  const searchForSuggestions =
    actions.find((a) => a.id === suggestionsOpenForActionId)?.contractSearch ??
    "";
  const { recentFiltered, knownFiltered } = useMemo(() => {
    const q = searchForSuggestions.trim().toLowerCase();
    const matches = (name: string) => !q || name.toLowerCase().includes(q);
    const recent = recentContracts.filter(matches);
    const known = knownContracts.filter(
      (c) => matches(c) && !recentContracts.includes(c),
    );
    return { recentFiltered: recent, knownFiltered: known };
  }, [searchForSuggestions, recentContracts, knownContracts]);
  const hasSuggestions = recentFiltered.length > 0 || knownFiltered.length > 0;

  const activeAction = useMemo(
    () => actions.find((a) => a.id === activeActionId) ?? actions[0],
    [actions, activeActionId],
  );

  const loadContractAbi = async (actionId: string, accountName: string) => {
    const name = accountName.trim();
    if (!name) return;
    setIsLoadingAbi(true);
    setLoadingActionId(actionId);
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, abiError: "" } : a)),
    );
    setSuggestionsOpenForActionId(null);
    try {
      const abi = await fetchContractAbi(apiClient, name);
      addRecent(name);
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId
            ? {
                ...a,
                contractName: name,
                contractAbi: abi,
                contractActions: getActionNamesFromAbi(abi),
                selectedAction: "",
                formValues: {},
                formErrors: {},
                contractSearch: name,
                abiError: "",
              }
            : a,
        ),
      );
    } catch (err) {
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId
            ? {
                ...a,
                contractName: "",
                contractAbi: null,
                contractActions: [],
                selectedAction: "",
                formValues: {},
                formErrors: {},
                abiError:
                  err instanceof Error
                    ? err.message
                    : "Failed to load contract",
              }
            : a,
        ),
      );
    } finally {
      setIsLoadingAbi(false);
      setLoadingActionId(null);
    }
  };

  const handleContractSelect = (actionId: string, name: string) => {
    updateAction(actionId, () => ({ contractSearch: name }));
    setSuggestionsOpenForActionId(null);
    loadContractAbi(actionId, name);
  };

  const handleContractSearchSubmit = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (action?.contractSearch.trim()) {
      loadContractAbi(actionId, action.contractSearch.trim());
    }
  };

  const addAction = () => {
    const newAction = createEmptyAction();
    setActions((prev) =>
      prev.map((a) => ({ ...a, isExpanded: false })).concat(newAction),
    );
    setActiveActionId(newAction.id);
  };

  const removeAction = (actionId: string) => {
    setActions((prev) => {
      const next = prev.filter((a) => a.id !== actionId);
      if (next.length === 0) return [createEmptyAction()];
      const wasActive = activeActionId === actionId;
      if (wasActive) {
        setActiveActionId(next[0].id);
        return next.map((a) =>
          a.id === next[0].id ? { ...a, isExpanded: true } : a,
        );
      }
      return next;
    });
    if (suggestionsOpenForActionId === actionId) {
      setSuggestionsOpenForActionId(null);
    }
  };

  const duplicateAction = (actionId: string) => {
    const src = actions.find((a) => a.id === actionId);
    if (!src) return;
    const dup: ProposalAction = {
      ...createEmptyAction(),
      contractName: src.contractName,
      contractAbi: src.contractAbi,
      contractActions: src.contractActions,
      selectedAction: src.selectedAction,
      formValues: { ...src.formValues },
      formErrors: {},
      contractSearch: src.contractSearch,
      abiError: "",
      isExpanded: true,
    };
    const idx = actions.findIndex((a) => a.id === actionId);
    setActions((prev) =>
      prev
        .map((a) => ({ ...a, isExpanded: false }))
        .slice(0, idx + 1)
        .concat(dup, prev.slice(idx + 1)),
    );
    setActiveActionId(dup.id);
  };

  const updateAction = (
    actionId: string,
    updater: (a: ProposalAction) => Partial<ProposalAction>,
  ) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, ...updater(a) } : a)),
    );
  };

  const reorderActions = (newOrder: ProposalAction[]) => {
    setActions(newOrder);
  };

  const setActiveAndExpand = (actionId: string) => {
    setActiveActionId(actionId);
    setActions((prev) =>
      prev.map((a) => ({
        ...a,
        isExpanded: a.id === actionId,
      })),
    );
  };

  const toggleActionExpand = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    const willExpand = !action?.isExpanded;
    setActions((prev) =>
      prev.map((a) => ({
        ...a,
        isExpanded:
          a.id === actionId ? !a.isExpanded : willExpand ? false : a.isExpanded,
      })),
    );
    if (willExpand) {
      setActiveActionId(actionId);
    }
  };

  const setFieldValue = (
    actionId: string,
    fieldName: string,
    value: unknown,
  ) => {
    updateAction(actionId, (a) => ({
      formValues: { ...a.formValues, [fieldName]: value },
      formErrors: { ...a.formErrors, [fieldName]: "" },
    }));
  };

  const validateFieldBlur = (
    actionId: string,
    fieldName: string,
    abiType: string,
    value: unknown,
  ) => {
    const err = validateField(value, abiType);
    updateAction(actionId, (a) => ({
      formErrors: { ...a.formErrors, [fieldName]: err ?? "" },
    }));
  };

  useEffect(() => {
    if (activeActionId == null && actions.length > 0) {
      setActiveActionId(actions[0].id);
      setActions((prev) =>
        prev.map((a, idx) => ({ ...a, isExpanded: idx === 0 })),
      );
    }
  }, [activeActionId, actions.length]);

  useEffect(() => {
    setStep(1);
    setTitle("");
    setDescription("");
    setMemo("");
    setSubmitError("");
    const first = createEmptyAction();
    setActions([first]);
    setActiveActionId(first.id);
  }, []);

  useEffect(() => {
    const current = selectedPlanet?.value ?? "eyeke";
    if (current !== previousPlanet) {
      const t = setTimeout(() => setPreviousPlanet(current), 500);
      return () => clearTimeout(t);
    }
  }, [selectedPlanet?.value, previousPlanet]);

  const handleCreate = async () => {
    const validationError = getValidationError();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError("");

    const connectedSession = session;
    if (!connectedSession) {
      setSubmitError("Wallet not connected");
      return;
    }
    const planetVal = selectedPlanet!.value;
    const daoVal = selectedDao!.value;
    const dac_id = getDacId(planetVal, daoVal as "syndicate" | "union");
    const proposer = connectedSession.actor.toString();
    const actionActor = getDacProposer(dac_id);
    if (!actionActor) {
      setSubmitError(`No proposer mapping found for DAC: ${dac_id}`);
      return;
    }
    const validActions = confirmationActions;

    setIsSubmitting(true);
    try {
      const proposalExpiration = getProposalExpiration(7);

      const proposal_name = generateRandomProposalName();
      const innerTrxAuthorization = [
        { actor: actionActor, permission: "active" as const },
      ];
      const signerAuthorization = [
        { actor: proposer, permission: "active" as const },
      ];
      const requested = innerTrxAuthorization;

      const serializedActions = validActions.map((a) => {
        const actionFields = getActionFields(a.contractAbi!, a.selectedAction);
        const data =
          actionFields.length > 0
            ? coerceActionData(a.formValues, actionFields)
            : {};
        return serializeActionForProposal(
          a.contractName,
          a.selectedAction,
          innerTrxAuthorization,
          data,
          a.contractAbi!,
        );
      });

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
          expiration: proposalExpiration,
          context_free_actions: [],
          delay_sec: "0",
          max_cpu_usage_ms: 0,
          max_net_usage_words: "0",
          ref_block_num: 0,
          ref_block_prefix: 0,
          actions: serializedActions,
          transaction_extensions: [],
        },
      };

      const proposeAction = {
        account: MSIG_CONTRACT,
        name: "propose",
        data: basicProposal,
        authorization: signerAuthorization,
      };

      await connectedSession.transact(
        { actions: [proposeAction] },
        { expireSeconds: 1200 },
      );

      onNotify?.("success", "Proposal was created successfully.");
      onSuccess?.(dac_id);
      onCancel();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Transaction failed";
      setSubmitError(errorMessage);
      onNotify?.("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid =
    title.trim() !== "" &&
    description.trim() !== "" &&
    selectedPlanet != null &&
    selectedDao != null;

  const hasValidActions = actions.some(
    (a) => a.contractName && a.selectedAction && a.contractAbi,
  );

  const confirmationActions = useMemo(
    () =>
      actions.filter(
        (a) => a.contractName && a.selectedAction && a.contractAbi,
      ),
    [actions],
  );
  const confirmationExpireDate = useMemo(() => getProposalExpiration(7), []);

  const getValidationError = () => {
    if (!session) return "Wallet not connected";
    const planetVal = selectedPlanet?.value;
    const daoVal = selectedDao?.value;
    if (!planetVal || !daoVal) return "Select planet and DAO";
    if (!title.trim()) return "Title is required";
    if (!description.trim()) return "Description is required";

    const validActions = actions.filter(
      (a) => a.contractName && a.selectedAction && a.contractAbi,
    );
    if (validActions.length === 0) return "Add at least one contract action";

    for (const a of validActions) {
      const actionFields = getActionFields(a.contractAbi!, a.selectedAction);
      if (actionFields.length > 0) {
        const missing = actionFields.filter(
          (f) =>
            a.formValues[f.name] == null ||
            String(a.formValues[f.name]).trim() === "",
        );
        const invalid = actionFields.filter((f) => a.formErrors[f.name]);
        if (missing.length > 0) {
          return `Fill required fields for ${a.contractName}::${
            a.selectedAction
          }: ${missing.map((f) => f.name).join(", ")}`;
        }
        if (invalid.length > 0) {
          return "Fix validation errors in the action forms";
        }
      }
    }
    return null;
  };

  const handleGoToConfirmation = () => {
    const validationError = getValidationError();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError("");
    setStep(3);
  };

  return (
    <>
      <main className="flex flex-col min-h-0 overflow-hidden flex-1 bg-transparent">
        {step !== 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden items-stretch">
            <div className="p-9 rounded-[12px] bg-black flex flex-col overflow-auto min-h-0">
              <h1
                className="create-proposal-heading mb-1"
                id="create-proposal-title"
              >
                {step === 1 ? "Create Proposal" : "Add Actions"}
              </h1>
              <p
                className={`create-proposal-subheading ${
                  step === 1 ? "mb-6" : "mb-8"
                }`}
              >
                {step === 1
                  ? "Please, fill the form and select DAO first, to be able to create proposal."
                  : "You will be able to add multiple actions for your General MSIG proposal"}
              </p>

              {step === 1 ? (
                <CreateProposalStep1
                  slot="form"
                  title={title}
                  setTitle={setTitle}
                  description={description}
                  setDescription={setDescription}
                  memo={memo}
                  setMemo={setMemo}
                  selectedPlanet={selectedPlanet}
                  setSelectedPlanet={setSelectedPlanet}
                  selectedDao={selectedDao}
                  setSelectedDao={setSelectedDao}
                  planetImages={planetImages}
                  planetIcons={planetIcons}
                  previousPlanet={previousPlanet}
                />
              ) : step === 2 ? (
                <CreateProposalStep2
                  slot="left"
                  actions={actions}
                  activeActionId={activeActionId}
                  setActiveActionId={setActiveAndExpand}
                  onExpandToggle={toggleActionExpand}
                  addAction={addAction}
                  removeAction={removeAction}
                  duplicateAction={duplicateAction}
                  updateAction={updateAction}
                  reorderActions={reorderActions}
                  loadContractAbi={loadContractAbi}
                  handleContractSelect={handleContractSelect}
                  handleContractSearchSubmit={handleContractSearchSubmit}
                  isLoadingAbi={isLoadingAbi}
                  loadingActionId={loadingActionId}
                  suggestionsOpenForActionId={suggestionsOpenForActionId}
                  setSuggestionsOpenForActionId={setSuggestionsOpenForActionId}
                  recentFiltered={recentFiltered}
                  knownFiltered={knownFiltered}
                  hasSuggestions={hasSuggestions}
                  selectedPlanet={selectedPlanet}
                  selectedDao={selectedDao}
                  planetImages={planetImages}
                  planetImagesLandscape={planetImagesLandscape}
                  planetIcons={planetIcons}
                />
              ) : null}
            </div>

            <div
              className={`relative rounded-[12px] flex flex-col min-h-0 overflow-hidden ${
                step === 1 ? "bg-black" : "bg-transparent"
              }`}
            >
              {step === 1 ? (
                <CreateProposalStep1
                  slot="preview"
                  title={title}
                  setTitle={setTitle}
                  description={description}
                  setDescription={setDescription}
                  memo={memo}
                  setMemo={setMemo}
                  selectedPlanet={selectedPlanet}
                  setSelectedPlanet={setSelectedPlanet}
                  selectedDao={selectedDao}
                  setSelectedDao={setSelectedDao}
                  planetImages={planetImages}
                  planetIcons={planetIcons}
                  previousPlanet={previousPlanet}
                />
              ) : step === 2 ? (
                <CreateProposalStep2
                  slot="right"
                  actions={actions}
                  activeAction={activeAction}
                  setFieldValue={setFieldValue}
                  validateFieldBlur={validateFieldBlur}
                  selectedPlanet={selectedPlanet}
                  selectedDao={selectedDao}
                  planetImages={planetImages}
                  planetImagesLandscape={planetImagesLandscape}
                  planetIcons={planetIcons}
                />
              ) : null}
            </div>
          </div>
        )}
      </main>

      {step !== 3 && (
        <div className="flex items-center justify-between gap-4 px-2">
          <p className="text-[13px] text-[#B9B9B9] font-titillium">
            Creating proposal step {step} of 3
          </p>
          <div className="flex items-center gap-3">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="create-proposal-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="create-proposal-next-btn"
                >
                  Next
                </button>
              </>
            ) : step === 2 ? (
              <>
                {submitError && (
                  <span className="text-sm text-red-400 font-titillium max-w-[280px] truncate">
                    {submitError}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleGoToConfirmation}
                  disabled={!isStep1Valid || !hasValidActions}
                  className="create-proposal-next-btn"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                {submitError && (
                  <span className="text-sm text-red-400 font-titillium max-w-[280px] truncate">
                    {submitError}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="create-proposal-cancel-btn"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!isStep1Valid || !hasValidActions}
                  className="create-proposal-next-btn"
                >
                  {isSubmitting ? "Submitting..." : "Confirm"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <CreateProposalStep3
          title={title}
          description={description}
          memo={memo}
          proposer={session?.actor.toString() ?? "—"}
          expireDate={confirmationExpireDate}
          selectedPlanet={selectedPlanet}
          selectedDao={selectedDao}
          actions={confirmationActions}
          planetImagesDetails={planetImagesDetails}
          planetIcons={planetIcons}
          submitError={submitError}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
          onBack={() => setStep(2)}
          onConfirm={handleCreate}
        />
      )}
    </>
  );
}
