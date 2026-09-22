import { createTestHarness } from "@paperclipai/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { fitOutput, requestBody, summarizeRun, USER_AGENT } from "../src/glasser-client.js";
import manifest from "../src/manifest.js";
import { TOOLS } from "../src/tools.generated.js";
import { executeSolutionTool } from "../src/worker.js";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A harness whose company config binds a key and whose http.fetch is ours. */
function harnessWith(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  const harness = createTestHarness({ manifest, config: { apiKeyRef: { type: "secret_ref", secretId: "sec-1" } } });
  const ctx = harness.ctx as unknown as {
    http: { fetch: typeof fetchImpl };
    secrets: { resolve: (ref: unknown) => Promise<string> };
  };
  ctx.http.fetch = fetchImpl;
  ctx.secrets.resolve = async () => "glsr_test_key";
  return harness;
}

const runCtx = { agentId: "a", runId: "r", companyId: "c", projectId: "p" };

describe("manifest", () => {
  it("declares the six Solution tools with JSON Schema parameters", () => {
    expect(manifest.tools?.map((t) => t.name)).toEqual([
      "web_research",
      "company_intelligence",
      "people_search",
      "seo_research",
      "social_research",
      "market_data",
    ]);
    for (const tool of manifest.tools ?? []) {
      expect(tool.parametersSchema).toMatchObject({ type: "object" });
      expect(tool.description.length).toBeGreaterThan(20);
    }
    expect(manifest.capabilities).toEqual(["agent.tools.register", "http.outbound", "secrets.read-ref"]);
  });

  it("social_research takes platform and mode, not action", () => {
    const social = TOOLS.find((t) => t.name === "social_research")!;
    const props = (social.parametersSchema as { properties: Record<string, unknown> }).properties;
    expect(Object.keys(props)).toContain("platform");
    expect(Object.keys(props)).toContain("mode");
    expect(Object.keys(props)).not.toContain("action");
  });
});

describe("requestBody", () => {
  it("splits comma-separated lists, parses integers, drops blanks", () => {
    expect(requestBody({ job_titles: "CTO, VP Engineering", limit: "5", email: "", provider: "auto" }, ["job_titles"], ["limit"])).toEqual({
      job_titles: ["CTO", "VP Engineering"],
      limit: 5,
      provider: "auto",
    });
    expect(requestBody({ keywords: ["a", " b "] }, ["keywords"], [])).toEqual({ keywords: ["a", "b"] });
    expect(() => requestBody({ limit: "many" }, [], ["limit"])).toThrow(/whole number/);
  });
});

describe("executeSolutionTool", () => {
  it("POSTs the body with the key, idempotency key and versioned User-Agent, and returns the run", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.glasser.ai/v1/solutions/gtm/social_research");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer glsr_test_key");
      expect(headers["User-Agent"]).toBe(USER_AGENT);
      expect(headers["User-Agent"]).toMatch(/^paperclip-plugin-glasser\/\d+\.\d+\.\d+ \(\+https:/);
      expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.parse(String(init?.body))).toEqual({ platform: "x", mode: "search", query: "breaking news" });
      return jsonResponse(200, {
        id: "run-1",
        status: "COMPLETED",
        provider: "tikhub",
        endpoint: "/api/v1/twitter/web/fetch_search_timeline",
        endpoint_version: 3,
        run_url: "https://app.glasser.ai/runs/run-1",
        output: { timeline: [{ text: "hi" }] },
        charge_usd: "0.001",
        charge_basis: { clause: "rule" },
      });
    });
    const harness = harnessWith(fetchImpl);
    const result = await executeSolutionTool(harness.ctx, "social_research", { platform: "x", mode: "search", query: "breaking news" }, runCtx);
    expect(result.error).toBeUndefined();
    expect(result.content).toContain("Run COMPLETED: tikhub /api/v1/twitter/web/fetch_search_timeline v3");
    expect(result.content).toContain("Charge: $0.001 (rule)");
    expect((result.data as { id: string }).id).toBe("run-1");
    expect((result.data as { idempotency_key: string }).idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("polls an in-flight run until it is terminal", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      calls += 1;
      if (calls === 1) return jsonResponse(202, { id: "run-2", status: "QUEUED" });
      expect(url).toBe("https://api.glasser.ai/v1/runs/run-2");
      return jsonResponse(200, { id: "run-2", status: "COMPLETED", provider: "serper", endpoint: "/search", endpoint_version: 1, output: [] });
    });
    const harness = harnessWith(fetchImpl);
    const result = await executeSolutionTool(harness.ctx, "web_research", { action: "search", query: "x" }, runCtx);
    expect(result.error).toBeUndefined();
    expect((result.data as { status: string }).status).toBe("COMPLETED");
    expect(calls).toBe(2);
  }, 15_000);

  it("hands the API's own error envelope to the agent", async () => {
    const harness = harnessWith(async () =>
      jsonResponse(400, {
        error: { code: "validation_failed", message: "'query' is required.", details: { field: "query" } },
        request_id: "req-9",
      })
    );
    const result = await executeSolutionTool(harness.ctx, "web_research", { action: "search" }, runCtx);
    expect(result.error).toContain("validation_failed: 'query' is required.");
    expect(result.error).toContain('"field":"query"');
    expect(result.error).toContain("request_id: req-9");
  });

  it("refuses with a clear message when no key is bound", async () => {
    const harness = createTestHarness({ manifest, config: {} });
    const result = await executeSolutionTool(harness.ctx, "web_research", { action: "search", query: "x" }, runCtx);
    expect(result.error).toMatch(/not configured/);
  });

  it("registers every tool on setup", async () => {
    const harness = harnessWith(async () => jsonResponse(200, { id: "r", status: "COMPLETED" }));
    const { default: plugin } = await import("../src/worker.js");
    await plugin.definition.setup(harness.ctx);
    const result = await harness.executeTool("market_data", { action: "stock_quote", symbol: "AAPL:NASDAQ" }, runCtx);
    expect(result.error).toBeUndefined();
  });
});

describe("output fitting", () => {
  it("trims a huge output and says so", () => {
    const run = { id: "r", status: "COMPLETED", output: Array.from({ length: 5000 }, (_, i) => ({ i, text: "x".repeat(200) })) };
    const fitted = fitOutput(run);
    expect(fitted.output_truncated).toBe(true);
    expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(60_000);
    expect(summarizeRun(fitted)).toContain("trimmed");
  });
});
