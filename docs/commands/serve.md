---
title: Netlify CLI serve command
sidebar:
  label: serve
description: (Beta) Build the site for production and serve locally. This does not watch the code for changes, so if you need to rebuild your site then you must exit and run `serve` again.
---

# `serve`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Build the site for production and serve locally. This does not watch the code for changes, so if you need to rebuild your site then you must exit and run `serve` again.

**Usage**

```bash
netlify serve
```

**Flags**

- `context` (*string*) - Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")
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
```


<!-- AUTO-GENERATED-CONTENT:END -->
