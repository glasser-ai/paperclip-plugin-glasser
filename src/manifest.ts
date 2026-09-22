import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { TOOLS } from "./tools.generated.js";
import { version } from "./version.js";

export const PLUGIN_ID = "glasser";

/**
 * The manifest declares the six tools the same way the worker registers
 * them: both read TOOLS, which is generated from Glasser's OpenAPI document.
 * The plugin never decides routing, providers or prices; Glasser does.
 */
const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version,
  displayName: "Glasser",
  description:
    "GTM data for your agents: web research, company intelligence, people search, SEO research, social media research and US market data. One Glasser Key covers every provider (Apollo, People Data Labs, Semrush, Ahrefs, DataForSEO, Serper, Exa, ScrapeCreators, RentCast and more); each call is one run billed at the routed endpoint's published price.",
  author: "Glasser <support@glasser.ai>",
  categories: ["connector"],
  capabilities: ["agent.tools.register", "http.outbound", "secrets.read-ref"],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      apiKeyRef: {
        // string | object: older hosts persist a bare secret UUID string; current
        // hosts bind `{ type: "secret_ref", secretId, version? }`.
        type: ["string", "object"],
        format: "secret-ref",
        title: "Glasser Key (secret reference)",
        description:
          "Your Glasser Key, stored as a secret. Create it at https://app.glasser.ai/keys, add it under Settings → Secrets, then pick it here.",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    parametersSchema: tool.parametersSchema,
  })),
};

export default manifest;
