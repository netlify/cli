---
title: Netlify CLI dev command
sidebar:
  label: dev
description: Run netlify dev locally
---

# `dev`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Local dev server
The dev command will run a local dev server with Netlify's proxy and redirect rules

**Usage**

```bash
netlify dev
```

**Flags**

- `command` (*string*) - command to run
- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)
- `country` (*string*) - Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)
- `dir` (*string*) - dir with static files
- `edge-inspect` (*string*) - enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format
- `edge-inspect-brk` (*string*) - enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `framework` (*string*) - framework to use. Defaults to #auto which automatically detects a framework
- `functions` (*string*) - specify a functions folder to serve
- `functions-port` (*string*) - port of functions server
- `geo` (*cache | mock | update*) - force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location
- `live` (*string*) - start a public live session; optionally, supply a subdomain to generate a custom URL
- `no-open` (*boolean*) - disables the automatic opening of a browser window
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `offline` (*boolean*) - Disables any features that require network access
- `port` (*string*) - port of netlify dev
- `skip-gitignore` (*boolean*) - skip adding .netlify to .gitignore file
- `target-port` (*string*) - port of target app server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/commands/dev#devexec) | Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons  |


**Examples**

```bash
netlify dev
netlify dev -d public
netlify dev -c "hugo server -w" --target-port 1313
netlify dev --context production # Use env var values from production context
netlify dev --context deploy-preview # Use env var values from deploy-preview context
netlify dev --context branch:feat/make-it-pop # Use env var values from the feat/make-it-pop branch context or branch-deploy context
netlify dev --edge-inspect
netlify dev --edge-inspect=127.0.0.1:9229
netlify dev --edge-inspect-brk
netlify dev --edge-inspect-brk=127.0.0.1:9229
netlify dev --skip-gitignore # skip adding .netlify to .gitignore
BROWSER=none netlify dev # disable browser auto opening
```

---
## `dev:exec`

Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons

**Usage**

```bash
netlify dev:exec
```

**Arguments**

- ...cmd - the command that should be executed

**Flags**

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify dev:exec npm run bootstrap
netlify dev:exec --context deploy-preview npm run bootstrap # Run with env var values from deploy-preview context
netlify dev:exec --context branch:feat/make-it-pop npm run bootstrap # Run with env var values from the feat/make-it-pop branch context or branch-deploy context
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
