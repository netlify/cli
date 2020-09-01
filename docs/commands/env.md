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

| Subcommand | description  |
|:--------------------------- |:-----|
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

- `debug` (*boolean*) - Print debugging information

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

- `debug` (*boolean*) - Print debugging information
- `replaceExisting` (*boolean*) - Replace all existing variables instead of merging them with the current ones

---
## `env:list`

Lists resolved environment variables for site (includes netlify.toml)

**Usage**

```bash
netlify env:list
```

**Flags**

- `debug` (*boolean*) - Print debugging information

---
## `env:set`

Set value of environment variable

**Usage**

```bash
netlify env:set
```

**Arguments**

- name - Environment variable name
- value - Value to set to

**Flags**

- `debug` (*boolean*) - Print debugging information

---
## `env:unset`

Unset an environment variable which removes it from the UI

**Usage**

```bash
netlify env:unset
```

**Arguments**

- name - Environment variable name

**Flags**

- `debug` (*boolean*) - Print debugging information

---

<!-- AUTO-GENERATED-CONTENT:END -->