"use client";

import { Trophy, AlertTriangle, Building2 } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import RankedTable, { type Column } from "@/components/RankedTable";
import BarValue from "@/components/BarValue";
import PageHeader from "@/components/PageHeader";
import { useMetrics } from "@/lib/useMetrics";
import type { TeamMemberRow, OverdueAssociationRow, AssociationVolumeRow } from "@/lib/metrics";
import styles from "../dashboard.module.css";

export default function TeamPerformancePage() {
  const { data, loading, error, reload } = useMetrics(30);

  const maxVol = Math.max(1, ...(data?.associationsByVolume ?? []).map((r) => r.workOrders));

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

  const volumeColumns: Column<AssociationVolumeRow>[] = [
    { key: "association", label: "Association" },
    { key: "workOrders", label: "Work orders", align: "right", render: (r) => <BarValue value={r.workOrders} max={maxVol} /> },
  ];

  return (
    <>
      <PageHeader
        title="Team performance"
        subtitle="Throughput, overdue scheduled work, and workload by association"
        loading={loading}
        onRefresh={reload}
      />

      {error && (
        <div className={styles.error} role="alert">
          <span>
            <strong>Couldn’t load metrics.</strong> {error}
          </span>
          <button className={styles.retry} onClick={reload}>
            Try again
          </button>
        </div>
      )}

      <div className={styles.grid}>
        <MetricCard
          title="Top performing team members"
          subtitle="Completed work orders + preventive tasks done, last 30 days"
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
          title="Top associations by work order volume"
          subtitle="All-time work orders logged per association"
          icon={<Building2 size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<AssociationVolumeRow>
              columns={volumeColumns}
              rows={data?.associationsByVolume ?? []}
              emptyMessage="No work orders found."
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
