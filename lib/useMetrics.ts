"use client";

import { useCallback, useEffect, useState } from "react";
import type { Metrics } from "./metrics";

export function useMetrics(days = 30) {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics?days=${days}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (HTTP ${res.status})`);
      setData(json as Metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
