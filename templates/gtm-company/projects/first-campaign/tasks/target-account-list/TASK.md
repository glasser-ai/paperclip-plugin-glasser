---
name: Build the first target account list
assignee: sales-researcher
project: first-campaign
---

Produce the first list of 20 target accounts with one to three contacts each.

Steps:

1. Read the ideal customer profile in the company goals. If any of industry,
   size, geography or buying titles is missing, ask the CEO in a comment and
   stop.
2. Take the example customers named in the goals (or ask for two), run
   `company_intelligence` with `action: competitors` on each, and `enrich` the
   candidates. Keep the 20 that fit the profile best.
3. For each kept account, run `people_search` with `action: search`, the
   buying titles, `company_domain`, `limit: 5`.
4. Deliver a table on this issue: company, domain, why it fits, contact,
   title, LinkedIn URL, run URLs. Do not call `find_email` yet; the CEO picks
   which contacts to resolve.
