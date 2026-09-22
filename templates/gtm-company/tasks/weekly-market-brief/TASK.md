---
name: Weekly market brief
assignee: market-researcher
recurring: true
---

Every week, report what changed for each competitor in the company goals and
what people said about the product category.

Steps:

1. `web_research` with `action: news`, `limit: 5`, per competitor name. Keep
   only items newer than the last brief.
2. `social_research` with `mode: search` on reddit and on x for the product
   category, `limit` default. Keep only posts newer than the last brief.
3. `company_intelligence` with `action: funding` per competitor domain; note
   any new round.
4. Deliver a brief on this issue: one paragraph per competitor with dated
   items and links, one paragraph on what people said, every claim with its
   run URL. If nothing changed, say so in one line and stop.
