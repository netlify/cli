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
- `port` (*string*) - port of netlify dev
- `targetPort` (*string*) - port of target app server
- `framework` (*string*) - framework to use. Defaults to #auto which automatically detects a framework
- `dir` (*string*) - dir with static files
- `functions` (*string*) - specify a functions folder to serve
- `offline` (*boolean*) - disables any features that require network access
- `live` (*boolean*) - start a public live session
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command  |
| [`dev:trace`](/docs/commands/dev.md#devtrace) | Trace command  |


**Examples**

```bash
$ netlify dev
$ netlify dev -d public
$ netlify dev -c "hugo server -w" --targetPort 1313
```

---
## `dev:exec`

Exec command
Runs a command within the netlify dev environment, e.g. with env variables from any installed addons


**Usage**

```bash
netlify dev:exec
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
$ netlify dev:exec npm run bootstrap
```

---
## `dev:trace`

Trace command
Simulates Netlify's Edge routing logic to match specific requests.
This command is designed to mimic cURL's command line, so the flags are more familiar.


**Usage**

```bash
netlify dev:trace
```

**Arguments**

- url - Sets the request URL

**Flags**

- `request` (*string*) - Specifies a custom request method [default: GET]
- `cookie` (*string*) - Request cookie, this flag can be used multiple times. Example: "nf_jwt=token"
- `header` (*string*) - Request header, this flag can be used multiple times. Example: "Host: netlify.test"
- `watch` (*string*) - Path to the publish directory
- `debug` (*boolean*) - Print debugging information

**Examples**

```bash
$ netlify dev:trace http://localhost/routing-path
$ netlify dev:trace -w dist-directory http://localhost/routing-path
$ netlify dev:trace -X POST http://localhost/routing-path
$ netlify dev:trace -H "Accept-Language es" http://localhost/routing-path
$ netlify dev:trace --cookie nf_jwt=token http://localhost/routing-path
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
