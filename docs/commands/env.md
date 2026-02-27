---
title: Netlify CLI env command
sidebar:
  label: env
description: Control environment variables for the current project
---

# `env`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Control environment variables for the current project

**Usage**

```bash
netlify env
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`env:clone`](/commands/env#envclone) | Clone environment variables from one project to another  |
| [`env:get`](/commands/env#envget) | Get resolved value of specified environment variable (includes netlify.toml)  |
| [`env:import`](/commands/env#envimport) | Import and set environment variables from .env file  |
| [`env:list`](/commands/env#envlist) | Lists resolved environment variables for project (includes netlify.toml)  |
| [`env:set`](/commands/env#envset) | Set value of environment variable  |
| [`env:unset`](/commands/env#envunset) | Unset an environment variable which removes it from the UI  |


**Examples**

```bash
netlify env:list
netlify env:get VAR_NAME
netlify env:set VAR_NAME value
netlify env:unset VAR_NAME
netlify env:import fileName
netlify env:clone --to <to-project-id>
```

---
## `env:clone`

Clone environment variables from one project to another

**Usage**

```bash
netlify env:clone
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Bypasses prompts & Force the command to run.
- `from` (*string*) - Project ID (From)
- `to` (*string*) - Project ID (To)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify env:clone --to <to-project-id>
netlify env:clone --to <to-project-id> --from <from-project-id>
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

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output environment variables as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `scope` (*builds | functions | post-processing | runtime | any*) - Specify a scope

**Examples**

```bash
netlify env:get MY_VAR # get value for MY_VAR in dev context
netlify env:get MY_VAR --context production
netlify env:get MY_VAR --context branch:feat/make-it-pop # get value in the feat/make-it-pop branch context or branch-deploy context
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

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output environment variables as JSON
- `replace-existing` (*boolean*) - Replace all existing variables instead of merging them with the current ones
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `env:list`

Lists resolved environment variables for project (includes netlify.toml)

**Usage**

```bash
netlify env:list
```

**Flags**

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: all contexts)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output environment variables as JSON
- `scope` (*builds | functions | post-processing | runtime | any*) - Specify a scope
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `plain` (*boolean*) - Output environment variables as plaintext

**Examples**

```bash
netlify env:list # list variables with values in the dev context and with any scope
netlify env:list --context production
netlify env:list --context branch:feat/make-it-pop # list variables with values in the feat/make-it-pop branch context or branch-deploy context
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

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: all contexts)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Bypasses prompts & Force the command to run.
- `json` (*boolean*) - Output environment variables as JSON
- `secret` (*boolean*) - Indicate whether the environment variable value can be read again.
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `scope` (*builds | functions | post-processing | runtime*) - Specify a scope (default: all scopes)

**Examples**

```bash
netlify env:set VAR_NAME value # set in all contexts and scopes
netlify env:set VAR_NAME value --context production
netlify env:set VAR_NAME value --context production deploy-preview # set in the production and deploy-preview contexts
netlify env:set VAR_NAME value --context branch:feat/make-it-pop # set in the feat/make-it-pop branch context
netlify env:set VAR_NAME value --context production --secret
netlify env:set VAR_NAME value --scope builds
netlify env:set VAR_NAME value --scope builds functions
netlify env:set VAR_NAME --secret # convert existing variable to secret
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

- `context` (*string*) - Specify a deploy context for environment variables (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: all contexts)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Bypasses prompts & Force the command to run.
- `json` (*boolean*) - Output environment variables as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify env:unset VAR_NAME # unset in all contexts
netlify env:unset VAR_NAME --context production
netlify env:unset VAR_NAME --context production deploy-preview
netlify env:unset VAR_NAME --context branch:feat/make-it-pop # unset in the feat/make-it-pop branch context
```

---

<!-- AUTO-GENERATED-CONTENT:END -->