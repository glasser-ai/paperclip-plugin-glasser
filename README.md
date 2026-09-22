# paperclip-plugin-glasser

GTM data for your [Paperclip](https://paperclip.ing) agents. This plugin exposes
[Glasser](https://glasser.ai)'s six Solution endpoints as agent tools:

| Tool | What the agent gets |
|---|---|
| `web_research` | Web, news, places, scholar, shopping, image and video search; read a page; an answer with sources |
| `company_intelligence` | Company profile and firmographics, technology stack, website traffic, similar companies, funding, news, from a domain |
| `people_search` | Contacts by title, seniority, location or employer; enrich one person; find a work email |
| `seo_research` | Keyword volume and difficulty, keyword ideas, Google results, domain overview, ranking keywords, backlinks, domain rating |
| `social_research` | Search posts, read a profile or channel, fetch one post, or find an account's other profiles on Reddit, X, YouTube, TikTok, Instagram and LinkedIn |
| `market_data` | US property values, rent estimates, property records, listings, ZIP market statistics, stock quotes |

One Glasser Key covers every provider behind these tools (Apollo, People Data
Labs, Hunter, Semrush, Ahrefs, DataForSEO, Serper, Exa, ScrapeCreators, TikHub,
RentCast and more). Glasser picks the provider unless the agent names one, and
each call is one run billed at the routed endpoint's published price. Every run
is visible in the Glasser console with its charge.

## Install

```bash
npx paperclipai plugin install paperclip-plugin-glasser
```

Then, in Paperclip:

1. Create a Glasser Key at https://app.glasser.ai/keys.
2. Add it under **Settings → Secrets**.
3. Open the Glasser plugin's settings and bind the secret to **Glasser Key**.

Every agent in the company can now call the six tools; Paperclip's per-agent
tool permissions apply as usual.

## How a call works

The agent calls a tool with the fields the contract defines, for example:

```json
{ "platform": "x", "mode": "search", "query": "breaking news" }
```

The plugin POSTs that body to `https://api.glasser.ai/v1/solutions/gtm/social_research`
with an `Idempotency-Key`, waits for the run to finish (polling `GET /v1/runs/{id}`
when the API answers 202), and returns:

- `content`: a short summary — status, provider and endpoint, charge, the run URL;
- `data`: the run itself, with the provider's output. A very large output is
  trimmed to fit the agent's context and says so; the full output stays at the
  run URL.

A refused call (for example a missing field) returns Glasser's own error, with
the field it points at, so the agent can correct and retry. Retrying with the
same `idempotency_key` never charges twice.

The plugin adds nothing to the API: no routing, no provider choice, no pricing.
Those live in Glasser, and the same tool definitions are used by the
[Dify plugin](https://github.com/glasser-ai/dify-glasser) and the
[n8n node](https://github.com/glasser-ai/n8n-nodes-glasser).

## Development

```bash
npm install
npm run gen          # regenerate src/tools.generated.ts from contract/openapi.json
npm run gen:refresh  # refresh that snapshot from https://glasser.ai/docs/openapi.json first
npm test
npm run build
```

`src/tools.generated.ts` is generated from Glasser's OpenAPI document and
committed; CI fails if it drifts from the snapshot. Do not edit it by hand.

Release: bump `version` in `package.json`, commit on `main`, tag the bare
semver (`0.2.0`), push the tag. The `Publish` workflow publishes to npm with a
provenance statement.

## License

MIT © Glasser
