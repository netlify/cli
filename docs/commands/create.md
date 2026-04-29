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

- `account-slug` (*string*) - account slug to create the project under
- `agent` (*string*) - agent type (claude, codex, gemini)
- `dir` (*string*) - directory to create the project in (defaults to current directory)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `git` (*string*) - create a git repository and push source code (e.g. github)
- `json` (*boolean*) - output result as JSON
- `model` (*string*) - model to use for the agent
- `name` (*string*) - project name (subdomain)
- `no-download` (*boolean*) - skip downloading source code after the agent run completes
- `no-wait` (*boolean*) - return immediately after starting the agent run without polling for completion
- `prompt` (*string*) - description of the site to create
- `repo-owner` (*string*) - GitHub org or user to create the repo under
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify create "a portfolio site"
netlify create --prompt "a blog with dark mode" --agent claude
netlify create "landing page for a coffee shop" --account-slug my-team
netlify create "an e-commerce store" --name my-store
netlify create "an e-commerce store" --git github
netlify create "an e-commerce store" --no-wait
```


<!-- AUTO-GENERATED-CONTENT:END -->
