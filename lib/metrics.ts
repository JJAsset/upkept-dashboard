import { UpkeptClient, asArray, type ToolResult } from "./upkeptClient";
import { loadOrgTree, norm, stripHyphens, type Association } from "./orgTree";

// ---------- shared types (only the fields we use) ----------
interface User { firstName?: string; lastName?: string; username?: string; roles?: string[] }
interface Assignee { user?: User; teamId?: { id?: string } }
interface WorkOrder {
  id?: string;
  property?: { id?: string };
  state?: string;
  createdAt?: string;
  closedAt?: string;
  lastCompletedAt?: string;
  assignee?: Assignee | null;
  assetId?: { id?: string } | null;
}
interface PmTask { done?: boolean; doneAt?: string | null }
interface Pm {
  propertyId?: { id?: string };
  assignee?: (Assignee & User) | null;
  interval?: string;
  state?: string;
  createdAt?: string;
  unitOfTasks?: { tasks?: PmTask[] };
}
interface Asset { assetId?: { id?: string }; type?: { name?: string } }

// ---------- output types ----------
export interface TeamMemberRow { rank: number; name: string; username: string; completedWorkOrders: number; pmsDone: number; total: number }
export interface OverdueAssociationRow { rank: number; association: string; total: number; quarterly: number; biannually: number; yearly: number }
export interface AssetTypeRow { rank: number; assetType: string; workOrders: number }
export interface AssociationVolumeRow { rank: number; association: string; workOrders: number }
export interface AssetTypeCountRow { rank: number; assetType: string; count: number }
export interface Metrics {
  windowDays: number;
  generatedAt: string;
  teamMembers: TeamMemberRow[];
  overdueAssociations: OverdueAssociationRow[];
  assetTypes: AssetTypeRow[];
  associationsByVolume: AssociationVolumeRow[];
  commonAssetTypes: AssetTypeCountRow[];
}

// ---------- helpers ----------
const OVERDUE_CADENCES = new Set(["QUARTERLY", "BIANNUALLY", "YEARLY"]);
const COMPLETED_WO_STATES = new Set(["COMPLETED", "CLOSED"]);
const ms = (s?: string | null) => (s ? Date.parse(s) : NaN);

async function fetchAllPages<T>(
  client: UpkeptClient,
  tool: string,
  baseArgs: Record<string, unknown>,
  pageSize = 100,
  maxPages = 500,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const res: ToolResult = await client.callTool(tool, { ...baseArgs, page, pageSize });
    const items = asArray<T>(res.data);
    out.push(...items);
    if (items.length < pageSize) break;
  }
  return out;
}

// NOTE: queryWorkOrderItems' server-side `status` filter is ignored by the MCP
// (returns nothing), so we fetch every WO per association and filter client-side.
async function fetchAllWorkOrders(client: UpkeptClient, assocs: Association[]): Promise<WorkOrder[]> {
  const out: WorkOrder[] = [];
  for (const a of assocs) {
    out.push(...(await fetchAllPages<WorkOrder>(client, "queryWorkOrderItems", { associationId: stripHyphens(a.id) })));
  }
  return out;
}

function personFrom(a: (Assignee & Partial<User>) | null | undefined): { username: string; name: string } | null {
  if (!a) return null;
  const u: User = (a as Assignee).user ?? (a as User);
  if (!u || !u.username) return null;
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username;
  return { username: u.username, name };
}

// ---------- Metric 1: top performing team members (completed WOs + PMs done) ----------
function topTeamMembers(workOrders: WorkOrder[], donePms: Pm[], windowStartMs: number): TeamMemberRow[] {
  const tally = new Map<string, { name: string; wo: number; pm: number }>();
  const bump = (p: { username: string; name: string } | null, kind: "wo" | "pm") => {
    if (!p) return;
    const cur = tally.get(p.username) ?? { name: p.name, wo: 0, pm: 0 };
    cur[kind]++;
    cur.name = p.name;
    tally.set(p.username, cur);
  };

  for (const wo of workOrders) {
    if (!COMPLETED_WO_STATES.has(wo.state ?? "")) continue;
    const done = ms(wo.closedAt ?? wo.lastCompletedAt);
    if (Number.isFinite(done) && done >= windowStartMs) bump(personFrom(wo.assignee), "wo");
  }

  for (const pm of donePms) {
    const doneTimes = (pm.unitOfTasks?.tasks ?? []).map((t) => ms(t.doneAt)).filter(Number.isFinite);
    const completed = doneTimes.length ? Math.max(...doneTimes) : ms(pm.createdAt);
    if (Number.isFinite(completed) && completed >= windowStartMs) bump(personFrom(pm.assignee), "pm");
  }

  return [...tally.entries()]
    .map(([username, v]) => ({ username, name: v.name, completedWorkOrders: v.wo, pmsDone: v.pm, total: v.wo + v.pm }))
    .sort((x, y) => y.total - x.total || y.completedWorkOrders - x.completedWorkOrders)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- Metric 2: top associations by overdue quarterly/biannual/annual units of tasks ----------
function topOverdueAssociations(overduePms: Pm[], propertyToAssociation: Map<string, Association>): OverdueAssociationRow[] {
  const agg = new Map<string, { name: string; quarterly: number; biannually: number; yearly: number }>();
  for (const pm of overduePms) {
    const interval = (pm.interval ?? "").toUpperCase();
    if (!OVERDUE_CADENCES.has(interval)) continue;
    const assoc = propertyToAssociation.get(norm(pm.propertyId?.id));
    const key = assoc?.id ?? "__unmapped__";
    const cur = agg.get(key) ?? { name: assoc?.name ?? "(unmapped property)", quarterly: 0, biannually: 0, yearly: 0 };
    if (interval === "QUARTERLY") cur.quarterly++;
    else if (interval === "BIANNUALLY") cur.biannually++;
    else if (interval === "YEARLY") cur.yearly++;
    agg.set(key, cur);
  }

  return [...agg.values()]
    .map((v) => ({ association: v.name, total: v.quarterly + v.biannually + v.yearly, quarterly: v.quarterly, biannually: v.biannually, yearly: v.yearly }))
    .sort((x, y) => y.total - x.total)
    .slice(0, 5)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- Metric 3: top asset types by work orders created ----------
function topAssetTypesByWorkOrders(workOrders: WorkOrder[], typeById: Map<string, string>, windowStartMs: number): AssetTypeRow[] {
  const tally = new Map<string, number>();
  for (const wo of workOrders) {
    if (!(ms(wo.createdAt) >= windowStartMs)) continue;
    if (!wo.assetId?.id) continue; // metric is about asset types
    const type = typeById.get(norm(wo.assetId.id)) ?? "Unknown type";
    tally.set(type, (tally.get(type) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([assetType, workOrders]) => ({ assetType, workOrders }))
    .sort((x, y) => y.workOrders - x.workOrders)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- Card: top associations by total work-order volume (all-time) ----------
function topAssociationsByWorkOrders(workOrders: WorkOrder[], propertyToAssociation: Map<string, Association>): AssociationVolumeRow[] {
  const tally = new Map<string, { name: string; count: number }>();
  for (const wo of workOrders) {
    const assoc = propertyToAssociation.get(norm(wo.property?.id));
    if (!assoc) continue;
    const cur = tally.get(assoc.id) ?? { name: assoc.name, count: 0 };
    cur.count++;
    tally.set(assoc.id, cur);
  }
  return [...tally.values()]
    .map((v) => ({ association: v.name, workOrders: v.count }))
    .sort((x, y) => y.workOrders - x.workOrders)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- Card: most common asset types (by asset count) ----------
function topAssetTypesByCount(assets: Asset[]): AssetTypeCountRow[] {
  const tally = new Map<string, number>();
  for (const a of assets) {
    const type = a.type?.name ?? "Unknown type";
    tally.set(type, (tally.get(type) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([assetType, count]) => ({ assetType, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ---------- orchestrator ----------
export async function computeMetrics(windowDays = 30): Promise<Metrics> {
  const client = await new UpkeptClient().init();
  const { associations, propertyToAssociation } = await loadOrgTree(client);
  const windowStartMs = Date.now() - windowDays * 86_400_000;

  const [workOrders, donePms, overduePms, assetsRes] = await Promise.all([
    fetchAllWorkOrders(client, associations),
    fetchAllPages<Pm>(client, "getPms", { state: "DONE" }),
    fetchAllPages<Pm>(client, "getPms", { state: "OVER_DUE" }),
    client.callTool("getAssets", {}),
  ]);

  const assets = asArray<Asset>(assetsRes.data);
  const typeById = new Map<string, string>();
  for (const a of assets) {
    if (a.assetId?.id) typeById.set(norm(a.assetId.id), a.type?.name ?? "Unknown type");
  }

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    teamMembers: topTeamMembers(workOrders, donePms, windowStartMs),
    overdueAssociations: topOverdueAssociations(overduePms, propertyToAssociation),
    assetTypes: topAssetTypesByWorkOrders(workOrders, typeById, windowStartMs),
    associationsByVolume: topAssociationsByWorkOrders(workOrders, propertyToAssociation),
    commonAssetTypes: topAssetTypesByCount(assets),
  };
}
