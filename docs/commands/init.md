---
title: Netlify CLI init command
sidebar:
  label: init
description: Initialize a new project locally
---

# `init`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Initialize a Netlify project in the current directory

Links this directory to a new or existing Netlify project and saves the project ID locally.
`netlify init` can be used with or without Git/continuous deployment.

The init command can:
- Create a new Netlify project, or link to an existing one
- Add `.netlify/` to `.gitignore`
- Create or update `netlify.toml` with detected build settings (optional)
- Connect a Git repository for continuous deployment (optional)

If no Git remote is detected, you can still create a project and deploy manually with `netlify deploy`.

**Usage**

```bash
netlify init
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Reinitialize CI hooks if the linked project is already configured to use CI
- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `manual` (*boolean*) - Manually configure a git remote for CI
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify init
netlify init --manual
netlify init --force
netlify init --git-remote-name upstream
```


<!-- AUTO-GENERATED-CONTENT:END -->
