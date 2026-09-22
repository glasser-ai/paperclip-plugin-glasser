/**
 * One call per tool: POST /v1/solutions/gtm/<capability> and hand back the run.
 *
 * The plugin adds nothing to the API: no routing, no parameter translation,
 * no fallback. Those live in Glasser. This module turns the agent's parameters
 * into the request body the contract expects (comma-separated strings become
 * arrays, numeric strings become integers, blanks are dropped), sends it with
 * an idempotency key, waits for an in-flight run, and trims a large output so
 * it fits the agent's context.
 */
import { randomUUID } from "node:crypto";
import { version } from "./version.js";

export const BASE_URL = "https://api.glasser.ai";
export const SOLUTION = "gtm";
/**
 * Reported to Glasser as `name/version (+repo)`, the RFC 9110 product-token
 * shape. The server parses client_name and client_version from the first
 * token and PostHog splits traffic by them; the version comes from
 * package.json so a release changes exactly one place.
 */
export const USER_AGENT = `paperclip-plugin-glasser/${version} (+https://github.com/glasser-ai/paperclip-plugin-glasser)`;

const TERMINAL = new Set(["COMPLETED", "FAILED", "STOPPED"]);
const CREATE_TIMEOUT_MS = 120_000;
const WAIT_BUDGET_MS = 180_000;
const POLL_MS = 2_000;
/** A run serialised above this many characters gets its output trimmed. */
const OUTPUT_BUDGET_CHARS = 60_000;

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface Run {
  id: string;
  status: string;
  provider?: string;
  endpoint?: string;
  endpoint_version?: number;
  run_url?: string;
  output?: unknown;
  failure?: { code?: string; message?: string } | null;
  provider_response?: { http_status?: number } | null;
  charge_usd?: string | number | null;
  charge_basis?: { clause?: string } | null;
  output_truncated?: boolean;
  output_note?: string;
  [key: string]: unknown;
}

/** A non-2xx answer, carrying the API's own error envelope. */
export class GlasserApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  readonly requestId: string | undefined;
  constructor(status: number, envelope: Record<string, unknown>) {
    const error = (envelope.error ?? {}) as { code?: string; message?: string; details?: unknown };
    super(error.code ? `${error.code}: ${error.message ?? ""}`.trim() : `HTTP ${status}`);
    this.name = "GlasserApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = typeof envelope.request_id === "string" ? envelope.request_id : undefined;
  }
}

/**
 * The contract's request body from the agent's parameters.
 *
 * Throws for a number that is not one; everything else is the API's to
 * validate, so its own error envelope reaches the agent.
 */
export function requestBody(
  params: Record<string, unknown>,
  lists: readonly string[],
  integers: readonly string[]
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (lists.includes(name)) {
      const items = (Array.isArray(value) ? value.map(String) : String(value).split(","))
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length > 0) body[name] = items;
    } else if (integers.includes(name)) {
      const n = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(n)) throw new Error(`'${name}' must be a whole number.`);
      body[name] = Math.trunc(n);
    } else {
      body[name] = typeof value === "string" ? value.trim() : value;
    }
  }
  return body;
}

async function send(
  fetchFn: Fetch,
  apiKey: string,
  url: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string; timeoutMs: number }
): Promise<Run> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetchFn(url, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: { code: "invalid_response", message: text.slice(0, 200) } };
  }
  if (response.status >= 200 && response.status < 300) return payload as Run;
  throw new GlasserApiError(response.status, payload as Record<string, unknown>);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST the solution call and, when the run is still in flight (202), poll
 * GET /v1/runs/{id} until it is terminal or the budget is spent. The
 * Idempotency-Key is generated once per call, so a transport retry reads the
 * original run instead of paying twice.
 */
export async function runSolution(
  fetchFn: Fetch,
  apiKey: string,
  capability: string,
  body: Record<string, unknown>
): Promise<{ run: Run; idempotencyKey: string }> {
  const idempotencyKey = randomUUID();
  let run = await send(fetchFn, apiKey, `${BASE_URL}/v1/solutions/${SOLUTION}/${capability}`, {
    method: "POST",
    body,
    idempotencyKey,
    timeoutMs: CREATE_TIMEOUT_MS,
  });
  const deadline = Date.now() + WAIT_BUDGET_MS;
  while (!TERMINAL.has(String(run.status)) && Date.now() < deadline) {
    await sleep(POLL_MS);
    run = await send(fetchFn, apiKey, `${BASE_URL}/v1/runs/${encodeURIComponent(run.id)}`, {
      method: "GET",
      timeoutMs: 30_000,
    });
  }
  return { run, idempotencyKey };
}

// ------------------------------------------------------------- output size

function trimPayload(value: unknown, maxItems: number, maxChars: number): unknown {
  if (Array.isArray(value)) {
    const head = value.slice(0, maxItems).map((v) => trimPayload(v, maxItems, maxChars));
    return value.length > maxItems ? [...head, `… ${value.length - maxItems} more items`] : head;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimPayload(v, maxItems, maxChars);
    return out;
  }
  if (typeof value === "string" && value.length > maxChars) return `${value.slice(0, maxChars)}…`;
  return value;
}

/**
 * Shrink run.output until the run serialises under the budget. Provider
 * payloads can run to megabytes (a full technology stack, a backlink dump);
 * the agent's context cannot hold that. The full output stays in the run
 * itself, reachable at run_url.
 */
export function fitOutput(run: Run, budgetChars = OUTPUT_BUDGET_CHARS): Run {
  if (JSON.stringify(run).length <= budgetChars) return run;
  const note = "Output trimmed to fit the context; the full provider output is at run_url.";
  for (const [maxItems, maxChars] of [
    [50, 4000],
    [25, 2000],
    [10, 1000],
    [5, 500],
    [3, 200],
  ] as const) {
    const candidate: Run = { ...run, output: trimPayload(run.output, maxItems, maxChars), output_truncated: true, output_note: note };
    if (JSON.stringify(candidate).length <= budgetChars) return candidate;
  }
  return { ...run, output: null, output_truncated: true, output_note: "Output too large for the context; read it at run_url." };
}

/** The one-paragraph summary the agent reads before the structured data. */
export function summarizeRun(run: Run, idempotencyKey?: string): string {
  const lines = [`Run ${run.status}: ${run.provider ?? "?"} ${run.endpoint ?? "?"} v${run.endpoint_version ?? "?"}`];
  if (run.provider_response?.http_status !== undefined) lines.push(`Provider answered HTTP ${run.provider_response.http_status}`);
  else if (run.status === "QUEUED" || run.status === "RUNNING") lines.push("Provider has not answered yet; the run URL shows its progress.");
  if (run.failure && (run.failure.code || run.failure.message)) lines.push(`Failure: ${run.failure.code ?? ""} ${run.failure.message ?? ""}`.trim());
  if (run.charge_usd !== null && run.charge_usd !== undefined) lines.push(`Charge: $${run.charge_usd} (${run.charge_basis?.clause ?? "clause unknown"})`);
  if (run.run_url) lines.push(`Run URL: ${run.run_url}`);
  if (run.output_truncated) lines.push("Output was trimmed to fit the context; the full provider output is at the run URL.");
  if (idempotencyKey) lines.push(`idempotency_key: ${idempotencyKey} (reuse it to retry; it never charges twice)`);
  return lines.join("\n");
}
