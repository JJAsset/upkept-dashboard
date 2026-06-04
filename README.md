# Upkept Metrics Dashboard

A small, **read-only** operational metrics dashboard over the Upkept (`enginite-mcp`) MCP server, built with **Next.js (App Router) + TypeScript** and styled with the **Odevo design system**.

It surfaces three metrics over a rolling **last‑30‑day** window:

1. **Top performing team members** — completed/closed work orders **+** preventive‑maintenance tasks (PMs) done, per person.
2. **Associations with overdue scheduled tasks** — PMs in state `OVER_DUE` with a **quarterly, bi‑annual, or annual** cadence, grouped by association (top 5).
3. **Top asset types by work orders** — work orders created in the window, grouped by the asset's type (top 10).

## Architecture

The Upkept token never reaches the browser. The React UI calls an internal API route; all MCP access and aggregation happen server‑side.

```
Browser ──> /api/metrics (server, 5‑min cache) ──> lib/metrics ──> lib/upkeptClient ──> Upkept MCP
```

| Path | Responsibility |
|------|----------------|
| `lib/upkeptClient.ts` | Server‑side MCP client. Hard‑guards a **read‑only allowlist** (57 `get*`/`list*`/`query*` tools); refuses every write tool. Reads endpoint/token from env. Includes session‑retry (see caveat below). |
| `lib/orgTree.ts` | Builds the `property → association` map from the org tree (by hierarchy prefix). |
| `lib/metrics.ts` | The three aggregations + pagination/window helpers. |
| `app/api/metrics/route.ts` | Server‑only route returning all three datasets as JSON, with a ~5‑minute in‑memory cache. |
| `app/`, `components/` | Dashboard UI: sidebar, metric cards, ranked tables, loading/empty/error states. |
| `scripts/build-tokens.mjs` | Generates `app/tokens.css` (CSS custom properties) from `design/tokens.json` (Odevo W3C design tokens). |

## Getting started

### Prerequisites
- Node.js 20+ (developed on Node 24)
- An Upkept MCP endpoint URL and a **read‑only** bearer token

### Setup

```bash
npm install
```

Create `.env.local` in the project root (this file is gitignored — never commit tokens):

```bash
# Production
UPKEPT_MCP_URL=https://upkeptassets.com/mcp/api/v1/mcp
UPKEPT_TOKEN=Bearer <your-read-only-jwt>

# Staging example:
# UPKEPT_MCP_URL=https://test.upkeptassets.com/mcp/api/v1/mcp
```

> Use a token from a **read‑only user** (e.g. `ROLE_USER`). The client also blocks all write tools as a second layer, but the credential scope is the real safeguard.

### Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

### Regenerate design tokens

If `design/tokens.json` changes:

```bash
node scripts/build-tokens.mjs   # rewrites app/tokens.css
```

## Switching environments

Point at staging vs production by changing **two env vars** (`UPKEPT_MCP_URL`, `UPKEPT_TOKEN`) and restarting. No code changes.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `UPKEPT_MCP_URL` | staging URL | MCP streamable‑HTTP endpoint |
| `UPKEPT_TOKEN` | _(required)_ | `Bearer <jwt>` for a read‑only user |
| `UPKEPT_SESSION_RETRIES` | `40` | Max retries per call to tolerate missing LB session affinity |

The time window can be set per request: `GET /api/metrics?days=30`.

## Known limitations & caveats

- **⚠️ Production load balancer has no session affinity.** Production runs multiple MCP instances behind a round‑robin LB, so the session created by `initialize` is only found on ~1/N follow‑up requests (others return `404 Session not found`). The client works around this by retrying until a request lands on the owning instance — reliable, but it multiplies request volume (~3×) and slows cold loads (tens of seconds). **The proper fix is server‑side:** enable sticky sessions / session affinity (or run the MCP server stateless). Once that's done, lower/remove `UPKEPT_SESSION_RETRIES`.
- **MCP quirks handled client‑side:** `queryWorkOrderItems`' `status` filter is ignored by the server and `X‑Total‑Count` isn't surfaced, so work orders are fully paginated and filtered in code.
- **PM completion time** is recorded per task (`unitOfTasks.tasks[].doneAt`); the latest such timestamp (fallback `createdAt`) places a PM in the window.
- **Asset‑type coverage:** work orders whose asset isn't in the visible asset set are bucketed as “Unknown type” rather than dropped.
- **Performance:** a cold load paginates all work orders across every association; results are cached ~5 minutes. For larger datasets consider added concurrency or scheduled precomputation.
- **Tokens are short‑lived** in these environments — expired tokens return `401`. Use a longer‑lived service credential or token refresh for a real deployment.

## Security

- Read‑only by design: server‑side credential scope **plus** a client‑side allowlist that refuses all non‑read MCP tools.
- Secrets live only in `.env.local` (gitignored). No tokens are committed.
