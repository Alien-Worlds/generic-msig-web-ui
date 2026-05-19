import type { Session } from "@wharfkit/session";
import { APIClient, FetchProvider } from "@wharfkit/antelope";
import { Chains } from "@wharfkit/session";
import type { Option } from "@alien-worlds/uikit";

export const inputClassName =
  "w-full h-10 px-3 rounded-lg border bg-[#100F10] text-white placeholder:text-white/60 font-titillium text-sm outline-none transition-colors border-white/10 hover:border-white/20 focus:border-[rgba(217,165,85,0.5)]";

export const PLANET_NAMES = [
  "eyeke",
  "kavian",
  "magor",
  "naron",
  "nerix",
  "veles",
  "testa", // TEMP: testing planet (uses eyeke images)
] as const;

export const PLANET_OPTIONS: Option[] = PLANET_NAMES.map((name) => ({
  value: name,
  label: name.charAt(0).toUpperCase() + name.slice(1),
}));

export const DAO_OPTIONS: Option[] = [
  { value: "syndicate", label: "Syndicate" },
  { value: "union", label: "Union" },
];

export function getApiClient(session: Session | undefined): APIClient {
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

export const DROPDOWN_STYLES = {
  control: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#100F10",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    height: 36,
    minHeight: 36,
    padding: "0 12px",
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
    fontSize: 14,
    fontFamily: '"Titillium Web", sans-serif',
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgba(255,255,255,0.6)",
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    backgroundColor: "#100F10",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
  }),
  option: (base: Record<string, unknown>, state: { isFocused?: boolean }) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(255,255,255,0.1)" : "transparent",
    color: "white",
    fontSize: 14,
    fontFamily: '"Titillium Web", sans-serif',
  }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgba(255,255,255,0.8)",
  }),
  indicatorSeparator: () => ({ display: "none" as const }),
};
