---
title: Netlify CLI db command
description: Provision a production ready Postgres database with a single command
sidebar:
  label: db
---

# `db`


<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Provision a production ready Postgres database with a single command

**Usage**

```bash
netlify db
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`init`](/commands/db#init) | Initialize a new database for the current site  |
| [`status`](/commands/db#status) | Check the status of the database  |


**Examples**

```bash
netlify db status
netlify db init
netlify db init --help
```

---
## `init`

Initialize a new database for the current site

**Usage**

```bash
netlify init
```

**Flags**

- `drizzle` (*boolean*) - Initialize basic drizzle config and schema boilerplate
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `minimal` (*boolean*) - Minimal non-interactive setup. Does not initialize drizzle or any boilerplate. Ideal for CI or AI tools.
- `no-drizzle` (*boolean*) - Does not initialize drizzle and skips any related prompts
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `overwrite` (*boolean*) - Overwrites existing files that would be created when setting up drizzle

**Examples**

```bash
netlify db init --minimal
netlify db init --drizzle --overwrite
```

---
## `status`

Check the status of the database

**Usage**

```bash
netlify status
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---

<!-- AUTO-GENERATED-CONTENT:END -->
