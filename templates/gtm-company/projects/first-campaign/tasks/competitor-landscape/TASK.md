---
name: Map the competitor landscape
assignee: market-researcher
project: first-campaign
---

Produce a one-page profile for each competitor in the company goals, plus a
short "who else is out there" list.

Steps:

1. For each competitor domain: `company_intelligence` with `enrich`,
   `traffic` and `funding`. Then `web_research` with `action: news`,
   `limit: 5`, on the company name.
2. `company_intelligence` with `action: competitors` on our own domain and on
   the largest competitor, to find names not yet in the set. Propose them; do
   not add them to the goals yourself.
3. `social_research` with `platform: reddit`, `mode: search` on the product
   category, `limit` default, to capture how people describe the alternatives.
4. Deliver one document on this issue: a profile per competitor (what they
   sell, size, traffic, last funding, last three news items) and the proposed
   additions, every claim with its run URL.
