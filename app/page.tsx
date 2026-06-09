"use client";

import { Boxes, Layers } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import RankedTable, { type Column } from "@/components/RankedTable";
import BarValue from "@/components/BarValue";
import PageHeader from "@/components/PageHeader";
import { useMetrics } from "@/lib/useMetrics";
import type { AssetTypeRow, AssetTypeCountRow } from "@/lib/metrics";
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
