---
title: Netlify CLI env command
description: Control environment variables for the current site
---

# `env`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Control environment variables for the current site

**Usage**

```bash
netlify env
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

| Subcommand | description  |
|:--------------------------- |:-----|
| [`env:clone`](/docs/commands/env.md#envclone) | Clone environment variables from one site to another  |
| [`env:get`](/docs/commands/env.md#envget) | Get resolved value of specified environment variable (includes netlify.toml)  |
| [`env:import`](/docs/commands/env.md#envimport) | Import and set environment variables from .env file  |
| [`env:list`](/docs/commands/env.md#envlist) | Lists resolved environment variables for site (includes netlify.toml)  |
| [`env:set`](/docs/commands/env.md#envset) | Set value of environment variable  |
| [`env:unset`](/docs/commands/env.md#envunset) | Unset an environment variable which removes it from the UI  |


**Examples**

```bash
netlify env:list
netlify env:get VAR_NAME
netlify env:set VAR_NAME value
netlify env:unset VAR_NAME
netlify env:import fileName
netlify env:clone --to <to-site-id>
```

---
## `env:clone`

Clone environment variables from one site to another

**Usage**

```bash
netlify env:clone
```

**Flags**

- `from` (*string*) - Site ID (From)
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `to` (*string*) - Site ID (To)

**Examples**

```bash
netlify env:clone --to <to-site-id>
netlify env:clone --to <to-site-id> --from <from-site-id>
```

---
## `env:get`

Get resolved value of specified environment variable (includes netlify.toml)

**Usage**

```bash
netlify env:get
```

**Arguments**

- name - Environment variable name

**Flags**

- `context` (*string*) - Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `scope` (*builds | functions | post-processing | runtime | any*) - Specify a scope

**Examples**

```bash
netlify env:get MY_VAR # get value for MY_VAR in dev context
netlify env:get MY_VAR --context production
netlify env:get MY_VAR --context branch:staging
netlify env:get MY_VAR --scope functions
```

---
## `env:import`

Import and set environment variables from .env file

**Usage**

```bash
netlify env:import
```

**Arguments**

- fileName - .env file to import

**Flags**

- `replace-existing` (*boolean*) - Replace all existing variables instead of merging them with the current ones
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

---
## `env:list`

Lists resolved environment variables for site (includes netlify.toml)

**Usage**

```bash
netlify env:list
```

**Flags**

- `context` (*string*) - Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `json` (*boolean*) - Output environment variables as JSON
- `plain` (*boolean*) - Output environment variables as plaintext
- `scope` (*builds | functions | post-processing | runtime | any*) - Specify a scope

**Examples**

```bash
netlify env:list # list variables with values in the dev context and with any scope
netlify env:list --context production
netlify env:list --context branch:staging
netlify env:list --scope functions
netlify env:list --plain
```

---
## `env:set`

Set value of environment variable

**Usage**

```bash
netlify env:set
```

**Arguments**

- key - Environment variable key
- value - Value to set to

**Flags**

- `context` (*string*) - Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `scope` (*builds | functions | post-processing | runtime*) - Specify a scope (default: all scopes)

**Examples**

```bash
netlify env:set VAR_NAME value # set in all contexts and scopes
netlify env:set VAR_NAME value --context production
netlify env:set VAR_NAME value --context production deploy-preview
netlify env:set VAR_NAME value --scope builds
netlify env:set VAR_NAME value --scope builds functions
```

---
## `env:unset`

Unset an environment variable which removes it from the UI

**Usage**

```bash
netlify env:unset
```

**Arguments**

- key - Environment variable key

**Flags**

- `context` (*string*) - Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
netlify env:unset VAR_NAME # unset in all contexts
netlify env:unset VAR_NAME --context production
netlify env:unset VAR_NAME --context production deploy-preview
```

---

<!-- AUTO-GENERATED-CONTENT:END -->