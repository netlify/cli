---
title: Netlify CLI create command
sidebar:
  label: create
description: Create a new Netlify project using an AI agent
---

# `create`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Create a new Netlify project using an AI agent

**Usage**

```bash
netlify create
```

**Arguments**

- prompt - description of the site to create

**Flags**

- `agent` (*string*) - agent type (claude, codex, gemini)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - output result as JSON
- `model` (*string*) - model to use for the agent
- `no-wait` (*boolean*) - return immediately after starting the agent run without polling for completion
- `prompt` (*string*) - description of the site to create
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `team` (*string*) - team slug to create the site in

**Examples**

```bash
netlify create "a portfolio site"
netlify create --prompt "a blog with dark mode" --agent claude
netlify create "landing page for a coffee shop" --team my-team
netlify create "an e-commerce store" --no-wait
```


<!-- AUTO-GENERATED-CONTENT:END -->
