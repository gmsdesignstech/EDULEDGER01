"use client";

import { readApiJson } from "@/lib/api-response";
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import useSWR, { SWRConfig, useSWRConfig, type SWRConfiguration } from "swr";

const CACHE_VERSION = "v1";
const ScopeContext = createContext("");

export const eduCacheProfiles = {
  configuration: {
    dedupingInterval: 5 * 60_000,
    focusThrottleInterval: 5 * 60_000,
    revalidateOnFocus: false,
  },
  live: {
    dedupingInterval: 10_000,
    focusThrottleInterval: 30_000,
    revalidateOnFocus: true,
  },
} satisfies Record<string, SWRConfiguration>;

async function jsonFetcher<T>([, url]: readonly [string, string]): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await readApiJson(response).catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unable to load data.");
  return body as T;
}

export function EduCacheProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const cache = useRef(new Map());
  const value = useMemo(() => `${CACHE_VERSION}:${scope}`, [scope]);
  return (
    <ScopeContext.Provider value={value}>
      <SWRConfig
        value={{
          provider: () => cache.current,
          dedupingInterval: 30_000,
          focusThrottleInterval: 60_000,
          keepPreviousData: true,
          revalidateIfStale: true,
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          shouldRetryOnError: false,
        }}
      >
        {children}
      </SWRConfig>
    </ScopeContext.Provider>
  );
}

export function useEduQuery<T>(url: string | null, options?: SWRConfiguration<T>) {
  const scope = useContext(ScopeContext);
  return useSWR<T>(url ? ([scope, url] as const) : null, jsonFetcher<T>, options);
}

export function useEduCache() {
  const scope = useContext(ScopeContext);
  const { cache, mutate } = useSWRConfig();
  const invalidate = useCallback(
    async (...prefixes: string[]) => {
      await mutate(
        (key) =>
          Array.isArray(key) &&
          key[0] === scope &&
          typeof key[1] === "string" &&
          (!prefixes.length || prefixes.some((prefix) => key[1].startsWith(prefix))),
      );
    },
    [mutate, scope],
  );
  const clear = useCallback(() => {
    for (const key of Array.from(cache.keys())) cache.delete(key);
  }, [cache]);
  return { invalidate, clear };
}
