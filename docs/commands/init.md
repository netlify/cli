---
title: Netlify CLI init command
description: Initialize a new site locally
---

# `init`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`

**Usage**

```bash
netlify init
```

**Flags**

- `config` (*string*) - Custom path to a netlify configuration file
- `filter` (*string*) - Optional name of an application to run the command in.
This option is needed for working in Monorepos
- `force` (*boolean*) - Reinitialize CI hooks if the linked site is already configured to use CI
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `manual` (*boolean*) - Manually configure a git remote for CI
- `debug` (*boolean*) - Print debugging information


<!-- AUTO-GENERATED-CONTENT:END -->
