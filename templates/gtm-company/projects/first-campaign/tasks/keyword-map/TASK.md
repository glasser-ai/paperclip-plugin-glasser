---
name: Build the first keyword map
assignee: seo-marketer
project: first-campaign
---

Produce a content plan of 15 to 25 keywords grouped by cluster.

Steps:

1. Take the category terms from the company goals as seeds. Run
   `seo_research` with `action: keyword_ideas`, `country: us`, `limit: 25`
   on each seed.
2. Keep keywords with meaningful volume and a difficulty we can win. For each
   kept keyword run `action: serp`, then read the top two results with
   `web_research` `action: scrape`.
3. Run `action: ranked_keywords` on our domain and on each competitor domain
   from the goals; list the terms competitors rank for and we do not.
4. Deliver the plan on this issue: keyword, volume, difficulty, intent,
   proposed title, the gap it fills, run URLs. One row per keyword, grouped
   by cluster.
