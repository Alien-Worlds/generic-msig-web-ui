/**
 * MSIG types and helpers for msig.worlds contract operations.
 * Per GENERIC_MSIG_UI_INSTRUCTIONS.md
 */

export interface ProposalPermissionLevel {
  actor: string;
  permission: string;
}

export interface EosioAction {
  account: string;
  name: string;
  authorization: ProposalPermissionLevel[];
  data: Record<string, unknown>;
}

export interface SerializedAction {
  account: string;
  name: string;
  authorization: ProposalPermissionLevel[];
  data: string;
}

export interface BasicProposal {
  proposer: string;
  proposal_name: string;
  requested: ProposalPermissionLevel[];
  dac_id: string;
  metadata: Array<{ key: string; value: string }>;
  trx: {
    expiration: string;
    context_free_actions: unknown[];
    delay_sec: string;
    max_cpu_usage_ms: number;
    max_net_usage_words: string;
    ref_block_num: number;
    ref_block_prefix: number;
    actions: SerializedAction[];
    transaction_extensions: unknown[];
  };
}

export interface ProposalApproval {
  dac_id: string;
  proposal_name: string;
  proposal_hash: string | null;
  level: ProposalPermissionLevel;
}

export interface ProposalExec {
  dac_id: string;
  executer: string;
  proposal_name: string;
}

export interface ProposalCancel {
  dac_id: string;
  canceler: string;
  proposal_name: string;
}

export const MSIG_CONTRACT = "msig.worlds";

/**
 * Generate a unique 12-char proposal name (lowercase + digits).
 */
export function generateRandomProposalName(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz12345";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Map planet + dao selection to dac_id.
 * Syndicate: planet name. Union: planet + "unn" (nerix -> neri for union suffix).
 */
export function getDacId(
  planet: string,
  dao: "syndicate" | "union"
): string {
  if (dao === "syndicate") {
    return planet.toLowerCase();
  }
  const base = planet.toLowerCase();
  if (base === "nerix") return "neriunn";
  return base + "unn";
}

/**
 * Map dac_id to proposer account used in msig proposal actions.
 */
const DAC_PROPOSER_MAP: Record<string, string> = {
  eyeke: "eyeke.dac",
  eyekeunn: "eye.unn.dac",
  kavian: "kavian.dac",
  kavianunn: "kav.unn.dac",
  magor: "magor.dac",
  magorunn: "mag.unn.dac",
  naron: "naron.dac",
  naronunn: "nar.unn.dac",
  neriunn: "ner.unn.dac",
  nerix: "neri.dac",
  testa: "testadacdacc",
  testb: "testb.dac",
  veles: "veles.dac",
  velesunn: "vel.unn.dac",
};

export function getDacProposer(dacId: string): string | null {
  const normalized = dacId.trim().toLowerCase();
  return DAC_PROPOSER_MAP[normalized] ?? null;
}

/**
 * Proposal expiration: 7 days from now, ISO string without trailing Z.
 */
export function getProposalExpiration(days = 7): string {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ).toISOString().replace("Z", "");
}

export type ProposalStatus =
  | "pending"
  | "approved"
  | "executed"
  | "expired"
  | "cancelled";

/**
 * Map dac_id to display name (e.g. "Kavian (Syndicate)", "Naron (Union)").
 */
export function getDaoDisplayName(dacId: string): string {
  const isUnion = dacId.endsWith("unn");
  const base = dacId.replace(/unn$/, "").replace(/eri$/, "rix"); // neriunn -> nerix
  const planet = base.charAt(0).toUpperCase() + base.slice(1);
  return `${planet} (${isUnion ? "Union" : "Syndicate"})`;
}
