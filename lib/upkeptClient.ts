// Server-side read-only MCP client for Upkept Assets (enginite-mcp).
// Hard-guards every call against an allowlist of read-only tools.
// Endpoint + token come from server env (never exposed to the browser).

const ENDPOINT = process.env.UPKEPT_MCP_URL ?? "https://test.upkeptassets.com/mcp/api/v1/mcp";

// --- SECURITY: only these read-only tools may ever be invoked. ---
export const READ_ONLY_TOOLS = new Set<string>([
  "findAssociation", "findByAlias", "findEngagement", "findProperty", "getAliases",
  "getAllAssociations", "getAllEngagements", "getAllResidentialProperties", "getAllTeams",
  "getAssessments", "getAsset", "getAssets", "getAssetTypes", "getAuthoritiesForRole",
  "getAvailableActions", "getComponents", "getContent", "getCurrentState", "getEntity",
  "getFieldEditability", "getFileImportHistory", "getFileProcessingStatus", "getMaintenancePlan",
  "getMaintenancePlans", "getManualApproveView", "getMetaData", "getMyColleagues", "getMyPreferences",
  "getMyTeams", "getPhoto", "getPm", "getPmIssues", "getPms", "getPmsV2", "getQuantities", "getRootNode",
  "getSeverityLevels", "getStateTransitions", "getStatistics", "getTeam", "getTeamMembers", "getThumbnail",
  "getTreeNode", "getTreeNodes", "getUser", "getUserAvatar", "getUsers", "getWorkOrder", "getWorkOrderTypes",
  "listAssociations", "listProperties", "queryWorkOrderItems", "readEvents", "subscribeToChanges",
  "subscribeToChanges_1", "userExist", "validateAlias",
]);

export interface ToolResult<T = unknown> {
  data: T;
  totalCount?: number;
  totalPages?: number;
  raw: unknown;
}

function loadAuth(): string {
  const t = process.env.UPKEPT_TOKEN?.trim();
  if (!t) throw new Error("UPKEPT_TOKEN is not set (server env).");
  return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
}

function parseBody(text: string, contentType: string | null): { error?: unknown; result?: Record<string, unknown> } {
  if (contentType && contentType.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.replace(/^data:\s?/, ""))
      .join("");
    return JSON.parse(data);
  }
  return JSON.parse(text);
}

// Production runs multiple MCP instances behind a load balancer with NO session
// affinity, so a session created on `initialize` is only found ~1/N requests.
// We retry session-not-found errors until the request lands on the owning
// instance (and periodically re-initialize in case the session expired).
const MAX_SESSION_RETRIES = Number(process.env.UPKEPT_SESSION_RETRIES ?? 40);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RawResponse {
  status: number;
  text: string;
  contentType: string | null;
}

export class UpkeptClient {
  private auth: string;
  private sessionId: string | null = null;
  private id = 0;

  constructor() {
    this.auth = loadAuth();
  }

  private async sendOnce(body: unknown): Promise<RawResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: this.auth,
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    return { status: res.status, text: await res.text(), contentType: res.headers.get("content-type") };
  }

  private isSessionError(status: number, text: string): boolean {
    return (status === 404 || status === 400) && /session/i.test(text);
  }

  async init(): Promise<this> {
    const res = await this.sendOnce({
      jsonrpc: "2.0",
      id: ++this.id,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "upkept-dashboard", version: "1.0.0" } },
    });
    if (res.status !== 200) throw new Error(`initialize failed: HTTP ${res.status} ${res.text}`);
    // Note: this server does not require notifications/initialized, and that
    // notification would just scatter to another LB instance — so we skip it.
    return this;
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<ToolResult<T>> {
    if (!READ_ONLY_TOOLS.has(name)) {
      throw new Error(`BLOCKED: '${name}' is not a read-only tool. Refusing to call.`);
    }

    let lastError = "";
    let res!: RawResponse;
    for (let attempt = 0; attempt < MAX_SESSION_RETRIES; attempt++) {
      if (!this.sessionId) await this.init();
      res = await this.sendOnce({ jsonrpc: "2.0", id: ++this.id, method: "tools/call", params: { name, arguments: args } });
      if (res.status === 200) break;
      if (this.isSessionError(res.status, res.text)) {
        lastError = res.text;
        if (attempt > 0 && attempt % 10 === 0) this.sessionId = null; // force fresh session
        await sleep(30 + attempt * 5);
        continue;
      }
      throw new Error(`tools/call ${name} failed: HTTP ${res.status} ${res.text}`);
    }
    if (res.status !== 200) {
      throw new Error(`tools/call ${name} failed after ${MAX_SESSION_RETRIES} retries (no LB session affinity). Last: ${lastError}`);
    }

    const text = res.text;
    const msg = parseBody(text, res.contentType);
    if (msg.error) throw new Error(`tools/call ${name} error: ${JSON.stringify(msg.error)}`);
    const result = (msg.result ?? {}) as Record<string, unknown>;

    let data: unknown = result.structuredContent ?? null;
    if (data == null && Array.isArray(result.content)) {
      const textPart = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      try {
        data = JSON.parse(textPart);
      } catch {
        data = textPart;
      }
    }

    return { data: data as T, raw: result };
  }
}

/** Normalise the various list-shaped payloads the MCP returns into a plain array. */
export function asArray<T = unknown>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    for (const k of ["content", "items", "workOrders", "users", "members", "result"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}
