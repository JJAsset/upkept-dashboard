"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, AlertTriangle, Boxes, RefreshCw, CalendarRange } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import RankedTable, { type Column } from "@/components/RankedTable";
import type { Metrics, TeamMemberRow, OverdueAssociationRow, AssetTypeRow } from "@/lib/metrics";
import styles from "./dashboard.module.css";

export default function Home() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics?days=30", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (HTTP ${res.status})`);
      setData(json as Metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxWO = Math.max(1, ...(data?.assetTypes ?? []).map((r) => r.workOrders));

  const teamColumns: Column<TeamMemberRow>[] = [
    { key: "name", label: "Team member" },
    { key: "completedWorkOrders", label: "WOs", align: "right" },
    { key: "pmsDone", label: "PMs", align: "right" },
    { key: "total", label: "Total", align: "right", render: (r) => <span className={styles.strong}>{r.total}</span> },
  ];

  const overdueColumns: Column<OverdueAssociationRow>[] = [
    { key: "association", label: "Association" },
    { key: "cadence", label: "Q · B · Y", align: "right", render: (r) => `${r.quarterly} · ${r.biannually} · ${r.yearly}` },
    { key: "total", label: "Overdue", align: "right", render: (r) => <span className={styles.danger}>{r.total}</span> },
  ];

  const assetColumns: Column<AssetTypeRow>[] = [
    { key: "assetType", label: "Asset type" },
    {
      key: "workOrders",
      label: "Work orders",
      align: "right",
      render: (r) => (
        <span className={styles.barWrap}>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${(r.workOrders / maxWO) * 100}%` }} />
          </span>
          <span className={styles.barValue}>{r.workOrders}</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Operational metrics</h1>
          <p className={styles.subhead}>Live, read-only view of Upkept production data</p>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.pill}>
            <CalendarRange size={16} aria-hidden="true" />
            Last 30 days
          </span>
          <button className={styles.refresh} onClick={load} disabled={loading} aria-label="Refresh metrics">
            <RefreshCw size={16} aria-hidden="true" className={loading ? styles.spin : undefined} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          <span>
            <strong>Couldn’t load metrics.</strong> {error}
          </span>
          <button className={styles.retry} onClick={load}>
            Try again
          </button>
        </div>
      )}

      <div className={styles.grid}>
        <MetricCard
          title="Top performing team members"
          subtitle="Completed work orders + preventive tasks done"
          icon={<Trophy size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<TeamMemberRow>
              columns={teamColumns}
              rows={data?.teamMembers ?? []}
              emptyMessage="No completed work in the last 30 days yet."
            />
          )}
        </MetricCard>

        <MetricCard
          title="Associations with overdue scheduled tasks"
          subtitle="Quarterly, bi-annual & annual units of tasks past due"
          icon={<AlertTriangle size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<OverdueAssociationRow>
              columns={overdueColumns}
              rows={data?.overdueAssociations ?? []}
              emptyMessage="No overdue quarterly, bi-annual or annual tasks. Nice and on top of it."
            />
          )}
        </MetricCard>

        <MetricCard
          title="Top asset types by work orders"
          subtitle="Work orders created in the last 30 days, by asset type"
          icon={<Boxes size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<AssetTypeRow>
              columns={assetColumns}
              rows={data?.assetTypes ?? []}
              emptyMessage="No work orders created in the last 30 days."
            />
          )}
        </MetricCard>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skel} />
      ))}
    </div>
  );
}
