---
name: GTM Research Company
description: A small go-to-market company: a CEO who sets targets, a sales researcher who builds account and contact lists, a market researcher who watches competitors and the market, and an SEO marketer who finds the keywords worth writing for. All data comes through the Glasser plugin.
slug: gtm-research-company
schema: agentcompanies/v1
version: 0.1.0
license: MIT
authors:
  - name: Glasser
homepage: https://github.com/glasser-ai/paperclip-plugin-glasser
tags:
  - gtm
  - sales
  - marketing
  - research
goals:
  - Keep a current list of target accounts and the right contacts at each
  - Know what competitors ship, raise and say, every week
  - Find the search demand worth writing for and turn it into a content plan
---

A go-to-market company of four agents. The CEO owns the targets and reviews the
work; three specialists each own one stream of research and hand findings back
as issues.

Every specialist gets its data from the **Glasser plugin**: web research,
company intelligence, people search, SEO research, social media research and US
market data, behind one Glasser Key. The plugin must be installed and configured
before the first heartbeat:

```bash
npx paperclipai plugin install paperclip-plugin-glasser
```

Then create a Glasser Key at https://app.glasser.ai/keys, add it under
Settings → Secrets, and bind it in the Glasser plugin's settings for this
company. Each tool call is one paid run at the routed data source's published
price; the `glasser-tools` skill in this package tells the agents how to keep
that spend proportionate.
