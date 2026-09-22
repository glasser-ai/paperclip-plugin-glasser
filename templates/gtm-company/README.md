# GTM Research Company

A Paperclip company package: a CEO and three research specialists whose data
comes through the [Glasser plugin](../../README.md).

```text
gtm-company/
├── COMPANY.md                      the company, its goals, what it needs
├── agents/
│   ├── ceo/AGENTS.md               sets targets, delegates, reviews, watches spend
│   ├── sales-researcher/AGENTS.md  target accounts and contacts
│   ├── market-researcher/AGENTS.md competitors, market, social listening
│   └── seo-marketer/AGENTS.md      keywords and the content plan
├── teams/gtm/TEAM.md               the three specialists as an importable subtree
├── skills/glasser-tools/SKILL.md   which Glasser tool answers which question, and how to spend little
├── projects/first-campaign/        three starter tasks, one per specialist
├── tasks/weekly-market-brief/      a recurring brief for the market researcher
└── .paperclip.yaml                 adapter per agent, the weekly schedule
```

## Use it

1. Install and configure the plugin on your Paperclip instance:
   ```bash
   npx paperclipai plugin install paperclip-plugin-glasser
   ```
   then bind a Glasser Key (https://app.glasser.ai/keys) in the plugin's
   settings for the company.
2. Import this folder as a new company (Paperclip → Companies → Import, or
   point the importer at
   `https://github.com/glasser-ai/paperclip-plugin-glasser/tree/main/templates/gtm-company`).
3. Edit the company goals: your ideal customer profile (industry, size,
   geography, buying titles), two example customers, your competitor domains,
   your product's category terms. The starter tasks read them.
4. Start the CEO. It assigns the three starter tasks and reviews what comes
   back.

Only the `gtm` team is needed if you already have a CEO: import
`teams/gtm/TEAM.md` and attach it under your manager.

## Cost

Every Glasser call is one paid run at the routed provider's published price;
the `glasser-tools` skill keeps the specialists on small `limit`s and makes
them cite the run URL for every claim. The first campaign, as written, is on
the order of a few dollars. Every run and its charge is listed in the Glasser
console.
