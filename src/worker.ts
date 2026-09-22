import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginContext, ToolResult, ToolRunContext } from "@paperclipai/plugin-sdk";
import { fitOutput, GlasserApiError, requestBody, runSolution, summarizeRun } from "./glasser-client.js";
import { TOOLS } from "./tools.generated.js";

/**
 * Resolve the Glasser Key for the company the tool call belongs to. The key
 * is bound in the plugin's company config as a secret reference; the value is
 * resolved per call and never cached, per the SDK's secrets contract.
 */
async function apiKeyFor(ctx: PluginContext, companyId: string): Promise<string | null> {
  const config = await ctx.config.get(companyId);
  const ref = config.apiKeyRef as string | { type: string; secretId: string } | undefined;
  if (!ref) return null;
  return ctx.secrets.resolve(ref as never, { companyId, configPath: "apiKeyRef" });
}

/** Execute one Solution tool: build the body, call Glasser, hand the run back. */
export async function executeSolutionTool(
  ctx: PluginContext,
  toolName: string,
  params: unknown,
  runCtx: ToolRunContext
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) return { error: `Unknown tool ${toolName}` };

  let body: Record<string, unknown>;
  try {
    body = requestBody((params ?? {}) as Record<string, unknown>, tool.lists, tool.integers);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const apiKey = await apiKeyFor(ctx, runCtx.companyId);
  if (!apiKey) {
    return {
      error:
        "Glasser plugin is not configured for this company: bind a Glasser Key under the plugin's settings (apiKeyRef).",
    };
  }

  try {
    const { run, idempotencyKey } = await runSolution((url, init) => ctx.http.fetch(url, init), apiKey, tool.name, body);
    const fitted = fitOutput(run);
    return {
      content: summarizeRun(fitted, idempotencyKey),
      data: { ...fitted, idempotency_key: idempotencyKey },
    };
  } catch (error) {
    if (error instanceof GlasserApiError) {
      // The API's own envelope reaches the agent: what Glasser said, not a
      // generic HTTP failure. Validation details name the field to fix.
      const details = error.details === undefined ? "" : `\nDetails: ${JSON.stringify(error.details)}`;
      const requestId = error.requestId ? `\nrequest_id: ${error.requestId}` : "";
      return { error: `${error.message}${details}${requestId}` };
    }
    ctx.logger.error("glasser call failed", { tool: toolName, error: String(error) });
    return { error: `Glasser call failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    for (const tool of TOOLS) {
      ctx.tools.register(
        tool.name,
        { displayName: tool.displayName, description: tool.description, parametersSchema: tool.parametersSchema },
        (params, runCtx) => executeSolutionTool(ctx, tool.name, params, runCtx)
      );
    }
    ctx.logger.info("glasser plugin ready", { tools: TOOLS.map((t) => t.name) });
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
