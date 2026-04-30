import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "msig-recent-contracts";
const MAX_RECENT = 15;

function getStorageKey(chainId: string): string {
  return `${STORAGE_KEY_PREFIX}-${chainId}`;
}

function loadFromStorage(chainId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(chainId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveToStorage(chainId: string, contracts: string[]) {
  try {
    localStorage.setItem(getStorageKey(chainId), JSON.stringify(contracts));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook to manage a cache of recently used/fetched contract names per chain.
 * Persists to localStorage.
 */
export function useRecentContracts(chainId: string) {
  const [recent, setRecent] = useState<string[]>(() =>
    loadFromStorage(chainId)
  );

  useEffect(() => {
    setRecent(loadFromStorage(chainId));
  }, [chainId]);

  const addRecent = useCallback(
    (contractName: string) => {
      const name = contractName.trim();
      if (!name) return;
      setRecent((prev) => {
        const filtered = prev.filter((c) => c !== name);
        const next = [name, ...filtered].slice(0, MAX_RECENT);
        saveToStorage(chainId, next);
        return next;
      });
    },
    [chainId]
  );

  return { recent, addRecent };
}
