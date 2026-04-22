"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function getApiBase() {
  // Client-side: use the proxy to avoid mixed content
  if (typeof window !== "undefined") {
    return "/api/proxy";
  }
  // Server-side: call the API directly (no mixed content issue)
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://34.30.107.174:8000/api/v1";
}

export function useApi<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
  options?: { enabled?: boolean }
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled !== false;
  const serializedParams = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = getApiBase();
      let url = `${base}${endpoint}`;

      const currentParams = paramsRef.current;
      if (currentParams) {
        const searchParams = new URLSearchParams();
        Object.entries(currentParams).forEach(([key, value]) => {
          if (value !== undefined && value !== "" && String(value) !== "all") {
            searchParams.append(key, String(value));
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }

      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, serializedParams, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}