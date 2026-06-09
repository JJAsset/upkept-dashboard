"use client";

import { Boxes, Layers, HeartPulse } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import RankedTable, { type Column } from "@/components/RankedTable";
import BarValue from "@/components/BarValue";
import PageHeader from "@/components/PageHeader";
import { useMetrics } from "@/lib/useMetrics";
import type { AssetTypeRow, AssetTypeCountRow, WorstConditionRow } from "@/lib/metrics";
import styles from "./dashboard.module.css";

export default function AssetInformationPage() {
  const { data, loading, error, reload } = useMetrics(30);

  const maxWO = Math.max(1, ...(data?.assetTypes ?? []).map((r) => r.workOrders));
  const maxCount = Math.max(1, ...(data?.commonAssetTypes ?? []).map((r) => r.count));

  const assetColumns: Column<AssetTypeRow>[] = [
    { key: "assetType", label: "Asset type" },
    { key: "workOrders", label: "Work orders", align: "right", render: (r) => <BarValue value={r.workOrders} max={maxWO} /> },
  ];

  const commonAssetColumns: Column<AssetTypeCountRow>[] = [
    { key: "assetType", label: "Asset type" },
    { key: "count", label: "Assets", align: "right", render: (r) => <BarValue value={r.count} max={maxCount} /> },
  ];

  const condColor = (c: number) =>
    c < 40
      ? "var(--color-palette-danger-500)"
      : c < 70
        ? "var(--color-palette-warning-700)"
        : "var(--color-palette-secondary-500)";

  const conditionColumns: Column<WorstConditionRow>[] = [
    { key: "asset", label: "Asset" },
    { key: "association", label: "Association" },
    {
      key: "condition",
      label: "Condition",
      align: "right",
      render: (r) => (
        <span className={styles.barWrap}>
          <span className={styles.barTrack}>
            <span style={{ display: "block", height: "100%", width: `${r.condition}%`, background: condColor(r.condition), borderRadius: "inherit" }} />
          </span>
          <span className={styles.barValue}>{r.condition}%</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Asset information"
        subtitle="Assets and asset-related work orders across the portfolio"
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
          title="Most common asset types"
          subtitle="Assets across the portfolio, grouped by type"
          icon={<Layers size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<AssetTypeCountRow>
              columns={commonAssetColumns}
              rows={data?.commonAssetTypes ?? []}
              emptyMessage="No assets found."
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

        <MetricCard
          title="Assets in worst condition"
          subtitle="Lowest recorded condition score across all assets"
          icon={<HeartPulse size={18} aria-hidden="true" />}
        >
          {loading ? (
            <Skeleton />
          ) : (
            <RankedTable<WorstConditionRow>
              columns={conditionColumns}
              rows={data?.worstConditionAssets ?? []}
              emptyMessage="No condition data recorded."
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
