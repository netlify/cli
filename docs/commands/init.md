---
title: Netlify CLI init command
sidebar:
  label: init
description: Initialize a new project locally
---

# `init`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Configure continuous deployment for a new or existing project. To create a new project without continuous deployment, use `netlify sites:create`

**Usage**

```bash
netlify init
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Reinitialize CI hooks if the linked project is already configured to use CI
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `manual` (*boolean*) - Manually configure a git remote for CI
- `mcp-scope` (*project | user*) - Add the Netlify MCP server for this project only, or for your user across all projects
- `reset-context` (*boolean*) - Replace locally edited Netlify skills with the latest release, and migrate or delete edited copies under renamed or deprecated names
- `reset-mcp-setup` (*boolean*) - Forget your saved Netlify MCP server choices and ask which AI coding agents to set up
- `skip-mcp-setup` (*boolean*) - Skip adding the Netlify MCP server to your AI coding agents
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `skip-agent-setup` (*boolean*) - Skip installing Netlify skills and adding the Netlify MCP server for AI coding agents


<!-- AUTO-GENERATED-CONTENT:END -->
