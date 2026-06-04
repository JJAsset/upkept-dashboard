import { NextResponse } from "next/server";
import { computeMetrics, type Metrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; days: number; data: Metrics } | null = null;

export async function GET(req: Request) {
  const days = Math.max(1, Math.min(365, Number(new URL(req.url).searchParams.get("days")) || 30));
  const now = Date.now();

  if (cache && cache.days === days && now - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers: { "x-cache": "hit" } });
  }

  try {
    const data = await computeMetrics(days);
    cache = { at: now, days, data };
    return NextResponse.json(data, { headers: { "x-cache": "miss" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
