---
title: Netlify CLI dev command
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
- `context` (*string*) - Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")
- `country` (*string*) - Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)
- `dir` (*string*) - dir with static files
- `edge-inspect` (*string*) - enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format
- `edge-inspect-brk` (*string*) - enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format
- `framework` (*string*) - framework to use. Defaults to #auto which automatically detects a framework
- `functions` (*string*) - specify a functions folder to serve
- `functions-port` (*string*) - port of functions server
- `geo` (*cache | mock | update*) - force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location
- `live` (*boolean*) - start a public live session
- `offline` (*boolean*) - disables any features that require network access
- `port` (*string*) - port of netlify dev
- `session-id` (*string*) - (Graph) connect to cloud session with ID [sessionId]
- `target-port` (*string*) - port of target app server
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command  |


**Examples**

```bash
netlify dev
netlify dev -d public
netlify dev -c "hugo server -w" --target-port 1313
netlify dev --context production
netlify dev --graph
netlify dev --edge-inspect
netlify dev --edge-inspect=127.0.0.1:9229
netlify dev --edge-inspect-brk
netlify dev --edge-inspect-brk=127.0.0.1:9229
BROWSER=none netlify dev # disable browser auto opening
```

---
## `dev:exec`

Exec command
Runs a command within the netlify dev environment, e.g. with env variables from any installed addons

**Usage**

```bash
netlify dev:exec
```

**Arguments**

- ...cmd - the command that should be executed

**Flags**

- `context` (*string*) - Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
netlify dev:exec npm run bootstrap
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
