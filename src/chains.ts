import type { ChainDefinitionType } from "@wharfkit/session";
import { Chains } from "@wharfkit/session";

/**
 * Chain definitions for the Session Kit.
 * Uses built-in ChainDefinitions (EOS, WAX, Telos) which include explorer links.
 * Extend this array to support more chains (e.g. Jungle4, UX) as needed.
 */
export const chains: ChainDefinitionType[] = [Chains.WAX];
