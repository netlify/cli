---
title: Netlify CLI database command
description: Provision a production ready Postgres database with a single command
sidebar:
  label: database
---

# `database`


<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Provision a production ready Postgres database with a single command

**Usage**

```bash
netlify database
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status`](/commands/database#status) | Check the status of the database, including applied and pending migrations  |
| [`init`](/commands/database#init) | Interactive setup: install the package, scaffold a starter migration, and verify the database  |
| [`connect`](/commands/database#connect) | Connect to the database  |
| [`reset`](/commands/database#reset) | Reset the local development database, removing all data and tables  |
| [`migrations`](/commands/database#migrations) | Manage database migrations  |


**Examples**

```bash
netlify database status
netlify database migrations apply
netlify database migrations pull
netlify database migrations new
netlify database reset
```

---
## `status`

Check the status of the database, including applied and pending migrations

**Usage**

```bash
netlify status
```

**Flags**

- `branch` (*string*) - Netlify branch name to query; defaults to the local development database
- `json` (*boolean*) - Output result as JSON
- `show-credentials` (*boolean*) - Include the full connection string (including username and password) in the output
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify database status
netlify database status --show-credentials
netlify database status --json
netlify database status --branch my-feature-branch
```

---
## `init`

Interactive setup: install the package, scaffold a starter migration, and verify the database

**Usage**

```bash
netlify init
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `yes` (*boolean*) - Non-interactive mode. Accepts the defaults for every prompt.
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify database init
netlify database init --yes
```

---
## `connect`

Connect to the database

**Usage**

```bash
netlify connect
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output query results as JSON. When used without --query, prints the connection details as JSON instead.
- `query` (*string*) - Execute a single query and exit
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify database connect
netlify database connect --query "SELECT * FROM users"
netlify database connect --json --query "SELECT * FROM users"
netlify database connect --json
```

---
## `reset`

Reset the local development database, removing all data and tables

**Usage**

```bash
netlify reset
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output result as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `migrations`

Manage database migrations

**Usage**

```bash
netlify migrations
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---

<!-- AUTO-GENERATED-CONTENT:END -->
