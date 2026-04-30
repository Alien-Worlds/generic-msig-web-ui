import type { ContractAbi } from "@/hooks/useContractAbi";

export interface ProposalAction {
  id: string;
  contractName: string;
  contractAbi: ContractAbi | null;
  contractActions: string[];
  selectedAction: string;
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  contractSearch: string;
  abiError: string;
  isExpanded: boolean;
}

export function createEmptyAction(): ProposalAction {
  return {
    id: crypto.randomUUID(),
    contractName: "",
    contractAbi: null,
    contractActions: [],
    selectedAction: "",
    formValues: {},
    formErrors: {},
    contractSearch: "",
    abiError: "",
    isExpanded: true,
  };
}
