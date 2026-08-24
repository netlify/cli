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

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Reinitialize CI hooks if the linked project is already configured to use CI
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `manual` (*boolean*) - Manually configure a git remote for CI


<!-- AUTO-GENERATED-CONTENT:END -->
