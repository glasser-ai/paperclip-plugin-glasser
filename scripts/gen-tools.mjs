#!/usr/bin/env node
// Generate src/tools.generated.ts from the Glasser OpenAPI document.
//
// The contract is the single truth for each tool: field names, types, enums,
// which are required, and the descriptions the agent reads all come from the
// request schema of POST /v1/solutions/gtm/<capability>. This script only adds
// what Paperclip needs on top: a display name per tool, and which fields each
// tool exposes (the same subset the Dify plugin and the n8n node show).
//
// Run at development time, commit the output:
//
//   npm run gen              # from the committed snapshot contract/openapi.json
//   npm run gen:refresh      # refresh the snapshot from https://glasser.ai/docs/openapi.json, then regenerate
//
// Paperclip only ever sees the committed TypeScript; nothing is fetched at runtime.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI_URL = 'https://glasser.ai/docs/openapi.json';
const SOLUTION = 'gtm';
const PATH_PREFIX = `/v1/solutions/${SOLUTION}/`;

// Order is the order tools are listed to the agent.
const TOOLS = {
  web_research: { displayName: 'Web Research', fields: ['action', 'provider', 'query', 'url', 'country', 'limit'] },
  company_intelligence: { displayName: 'Company Intelligence', fields: ['action', 'provider', 'domain', 'country', 'limit'] },
  people_search: { displayName: 'People Search', fields: ['action', 'provider', 'job_titles', 'seniorities', 'locations', 'company_domain', 'full_name', 'email', 'linkedin_url', 'limit'] },
  seo_research: { displayName: 'SEO Research', fields: ['action', 'provider', 'keywords', 'domain', 'country', 'limit'] },
  social_research: { displayName: 'Social Media Research', fields: ['platform', 'mode', 'provider', 'query', 'handle', 'url'] },
  market_data: { displayName: 'US Market Data', fields: ['action', 'provider', 'address', 'city', 'state', 'zip', 'symbol', 'limit'] },
};

// Fallback descriptions for fields whose schema carries none.
const FIELD_DESCRIPTIONS = {
  query: 'Search phrase or question.',
  url: 'A full http(s) URL.',
  domain: 'A company website domain, e.g. stripe.com.',
  keywords: "Keywords to look up, e.g. ['espresso machine'].",
  country: 'Two-letter country code or country name, e.g. us, gb, Germany (default us).',
  job_titles: "Job titles, e.g. ['CTO', 'VP Engineering'].",
  seniorities: 'Seniority levels.',
  locations: 'Cities, states or countries.',
  company_domain: "The employer's website domain, e.g. stripe.com.",
  full_name: "The person's full name, e.g. 'Patrick Collison'.",
  email: "The person's email address.",
  linkedin_url: "The person's LinkedIn profile URL.",
  handle: 'A username or handle without @, or a subreddit name.',
  address: "US street address, e.g. '5500 Grand Lake Dr, San Antonio, TX 78244'.",
  city: 'US city name; use with state.',
  state: 'Two-letter US state code, e.g. TX.',
  zip: 'Five-digit US ZIP code.',
  symbol: 'Ticker with exchange, e.g. AAPL:NASDAQ.',
  limit: 'Maximum number of rows to return.',
};

async function loadOpenapi(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    return response.json();
  }
  return JSON.parse(readFileSync(source, 'utf8'));
}

/** Strip the `anyOf [X, null]` an optional field is encoded as. */
function unwrap(prop) {
  if (prop.anyOf) {
    const branches = prop.anyOf.filter((b) => b.type !== 'null');
    if (branches.length === 1) return branches[0];
  }
  return prop;
}

/** JSON Schema for one field, keeping only what an agent needs. */
function fieldSchema(tool, name, raw) {
  const s = unwrap(raw);
  const out = {};
  if (s.type) out.type = s.type;
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = unwrap(s.items).type ? { type: unwrap(s.items).type } : s.items;
  if (s.minimum !== undefined) out.minimum = s.minimum;
  if (s.maximum !== undefined) out.maximum = s.maximum;
  const description = s.description ?? FIELD_DESCRIPTIONS[name];
  if (description) out.description = description;
  if (!out.type && !out.enum) throw new Error(`${tool}.${name}: no type in schema`);
  return out;
}

async function main() {
  const source = process.argv[2] ?? resolve(ROOT, 'contract/openapi.json');
  const doc = await loadOpenapi(source);
  const tools = [];
  for (const [capability, meta] of Object.entries(TOOLS)) {
    const path = `${PATH_PREFIX}${capability}`;
    const op = doc.paths?.[path]?.post;
    if (!op) throw new Error(`${path}: not in the OpenAPI document`);
    const schema = op.requestBody?.content?.['application/json']?.schema;
    if (!schema?.properties) throw new Error(`${path}: request schema has no properties`);
    const properties = {};
    const lists = [];
    const integers = [];
    for (const name of meta.fields) {
      const raw = schema.properties[name];
      if (!raw) throw new Error(`${path}: field ${name} is not in the contract`);
      const f = fieldSchema(capability, name, raw);
      properties[name] = f;
      if (f.type === 'array') lists.push(name);
      if (f.type === 'integer' || f.type === 'number') integers.push(name);
    }
    const required = (schema.required ?? []).filter((n) => meta.fields.includes(n));
    // The operation description is the tool description the agent reads; it ends
    // with the shared run/idempotency tail, which is about HTTP and not about
    // choosing the tool — drop it.
    const description = String(op.description ?? op.summary ?? '').split(/\n\n/)[0].trim();
    tools.push({
      name: capability,
      displayName: meta.displayName,
      description,
      parametersSchema: { type: 'object', properties, required, additionalProperties: false },
      lists,
      integers,
    });
  }
  const header = `// GENERATED by scripts/gen-tools.mjs from ${source.startsWith('http') ? source : 'the local OpenAPI document'} — do not edit.\n// Regenerate with \`npm run gen\` after the Glasser contract changes.\n`;
  const body = `${header}import type { JsonSchema } from "@paperclipai/plugin-sdk";\n\nexport const SOLUTION = ${JSON.stringify(SOLUTION)};\n\nexport interface ToolSpec {\n  readonly name: string;\n  readonly displayName: string;\n  readonly description: string;\n  readonly parametersSchema: JsonSchema;\n  /** Fields the contract types as arrays; a comma-separated string is accepted and split. */\n  readonly lists: readonly string[];\n  /** Fields the contract types as numbers; a numeric string is accepted and parsed. */\n  readonly integers: readonly string[];\n}\n\nexport const TOOLS: readonly ToolSpec[] = ${JSON.stringify(tools, null, 2)};\n`;
  const outPath = resolve(ROOT, 'src/tools.generated.ts');
  writeFileSync(outPath, body);
  console.log(`wrote ${outPath}: ${tools.length} tools`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
