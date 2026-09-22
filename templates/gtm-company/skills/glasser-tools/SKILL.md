---
name: glasser-tools
description: How to use the six Glasser tools (web_research, company_intelligence, people_search, seo_research, social_research, market_data) well and cheaply. Which tool answers which question, what to pass, how to read a result, and how to keep spend proportionate.
metadata:
  paperclip:
    tags:
      - gtm
      - research
      - glasser
---

# Glasser tools

The Glasser plugin gives you six tools. Each call is **one paid run** at a
data provider (Apollo, People Data Labs, Semrush, Ahrefs, DataForSEO, Serper,
Exa, ScrapeCreators, TikHub, RentCast and others). Glasser picks the provider,
handles a provider failure by trying the next one, and bills the run at the
provider's published price. You see the charge in every result.

## Which tool answers which question

| You want | Tool | Key fields |
|---|---|---|
| What the web, the news or a place says about X | `web_research` | `action` (search, news, places, scholar, shopping, images, videos, answer, scrape, similar), `query` or `url`, `country` |
| A company's profile, tech stack, traffic, competitors, funding, news | `company_intelligence` | `action`, `domain` |
| People at a company, one person's profile, a work email | `people_search` | `action` (search, enrich, find_email), `job_titles`, `seniorities`, `locations`, `company_domain`, `full_name`, `email`, `linkedin_url` |
| Keyword volume and difficulty, ideas, who ranks, a domain's SEO, backlinks | `seo_research` | `action`, `keywords`, `domain`, `country` |
| Posts, a profile, a feed, one post, or an account's other profiles on a social network | `social_research` | `platform` + `mode` (not `action`), `query`, `handle` or `url` |
| US property values, rents, listings, ZIP statistics, a stock quote | `market_data` | `action`, `address` / `city` + `state` / `zip` / `symbol` |

`social_research` is the odd one: it takes `platform` (reddit, x, youtube,
tiktok, instagram, linkedin) and `mode` (search, profile, feed, post, find).
Every platform supports every mode. `search` needs `query`; `profile`, `feed`
and `find` need `handle` (LinkedIn: `url`); `post` needs `url`; `find` on
reddit takes `query` and returns subreddits.

## Rules

1. **Start small.** Pass `limit: 5` on the first call of any new question.
   Widen only after the first rows look right. A `people_search` with
   `limit: 50` on the wrong titles is fifty wasted rows.
2. **Leave `provider` on `auto`** unless the task names a source. Auto is
   routed to the provider that serves that action best and falls back if it
   fails.
3. **Read the result before using it.** `content` is a summary: status,
   provider and endpoint, charge, run URL. `data.output` is the provider's
   answer. If `output_truncated` is true, the full output is at `run_url`;
   say so rather than pretending you saw all of it.
4. **A refused call is not a failure to retry blindly.** The error names the
   field to fix (`'query' is required`, `action 'x' is not served`). Fix the
   field, then call again.
5. **Cite the run.** Every finding you report carries its run URL so a human
   can open the provider's raw answer.
6. **Never make up what a tool did not return.** No contacts, emails, numbers
   or quotes that are not in `data.output`.
7. **One question per call.** Do not loop over a long list of domains or
   keywords in a single heartbeat; batch into a few calls with `limit`, report,
   and let the CEO decide whether to continue.

## Example calls

```json
{ "action": "enrich", "domain": "stripe.com" }
{ "action": "search", "job_titles": ["Head of Growth", "VP Marketing"], "company_domain": "stripe.com", "limit": 5 }
{ "action": "keyword_ideas", "keywords": ["ai sales agent"], "country": "us", "limit": 25 }
{ "platform": "reddit", "mode": "search", "query": "outbound sales tools" }
{ "action": "news", "query": "Stripe", "limit": 10 }
```
