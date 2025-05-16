---
title: Netlify CLI serve command
sidebar:
  label: serve
description:
  Build the project for production and serve locally. This does not watch the code for changes, so if you need to rebuild
  your project then you must exit and run `serve` again.
---

# `serve`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Build the project for production and serve locally. This does not watch the code for changes, so if you need to rebuild your project then you must exit and run `serve` again.

**Usage**

```bash
netlify serve
```

**Flags**

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)
- `country` (*string*) - Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)
- `dir` (*string*) - dir with static files
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `functions` (*string*) - specify a functions folder to serve
- `functions-port` (*string*) - port of functions server
- `geo` (*cache | mock | update*) - force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location
- `offline` (*boolean*) - Disables any features that require network access
- `port` (*string*) - port of netlify dev
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify serve
BROWSER=none netlify serve # disable browser auto opening
netlify serve --context production # Use env var values from production context
netlify serve --context deploy-preview # Use env var values from deploy-preview context
netlify serve --context branch:feat/make-it-pop # Use env var values from the feat/make-it-pop branch context or branch-deploy context
```


<!-- AUTO-GENERATED-CONTENT:END -->
