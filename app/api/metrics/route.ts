import { NextResponse } from "next/server";
import { computeMetrics, type Metrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Data is considered "fresh" for this long; after that it's served stale while a
// background refresh runs (stale-while-revalidate). A production cold compute is
// slow (no LB session affinity), so this keeps the UI instant after the first load.
const FRESH_MS = 5 * 60 * 1000;

let cache: { at: number; days: number; data: Metrics } | null = null;
let refreshing = false;

async function refresh(days: number) {
  if (refreshing) return;
  refreshing = true;
  try {
    const data = await computeMetrics(days);
    cache = { at: Date.now(), days, data };
  } catch (err) {
    // Keep serving the last good data; just log the failed refresh.
    console.error("[metrics] background refresh failed:", err instanceof Error ? err.message : err);
  } finally {
    refreshing = false;
  }
}

export async function GET(req: Request) {
  const days = Math.max(1, Math.min(365, Number(new URL(req.url).searchParams.get("days")) || 30));
  const now = Date.now();

  if (cache && cache.days === days) {
    const stale = now - cache.at >= FRESH_MS;
    if (stale) void refresh(days); // fire-and-forget; serve stale now
    return NextResponse.json(cache.data, { headers: { "x-cache": stale ? "stale" : "hit" } });
  }

  // No cache for this window yet — must compute synchronously (the only slow path).
  try {
    const data = await computeMetrics(days);
    cache = { at: now, days, data };
    return NextResponse.json(data, { headers: { "x-cache": "miss" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
