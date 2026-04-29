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
| [`database status`](/commands/database#database-status) | Check the status of the database, including applied and pending migrations  |
| [`database init`](/commands/database#database-init) | Interactive setup: install the package, scaffold a starter migration, and verify the database  |
| [`database connect`](/commands/database#database-connect) | Connect to the database  |
| [`database reset`](/commands/database#database-reset) | Reset the local development database, removing all data and tables  |
| [`database migrations`](/commands/database#database-migrations) | Manage database migrations  |


**Examples**

```bash
netlify database status
netlify database migrations apply
netlify database migrations pull
netlify database migrations new
netlify database reset
```

---
## `database status`

Check the status of the database, including applied and pending migrations

**Usage**

```bash
netlify database status
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
## `database init`

Interactive setup: install the package, scaffold a starter migration, and verify the database

**Usage**

```bash
netlify database init
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
## `database connect`

Connect to the database

**Usage**

```bash
netlify database connect
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
## `database reset`

Reset the local development database, removing all data and tables

**Usage**

```bash
netlify database reset
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output result as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `database migrations`

Manage database migrations

**Usage**

```bash
netlify database migrations
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`database migrations apply`](/commands/database#database-migrations-apply) | Apply database migrations to the local development database  |
| [`database migrations new`](/commands/database#database-migrations-new) | Create a new migration  |
| [`database migrations pull`](/commands/database#database-migrations-pull) | Pull migrations and overwrite local migration files  |
| [`database migrations reset`](/commands/database#database-migrations-reset) | Delete local migration files that have not been applied yet  |


---
## `database migrations apply`

Apply database migrations to the local development database

**Usage**

```bash
netlify database migrations apply
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output result as JSON
- `to` (*string*) - Target migration name or prefix to apply up to (applies all if omitted)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `database migrations new`

Create a new migration

**Usage**

```bash
netlify database migrations new
```

**Flags**

- `description` (*string*) - Purpose of the migration (used to generate the file name)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output result as JSON
- `scheme` (*sequential | timestamp*) - Numbering scheme for migration prefixes
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify database migrations new
netlify database migrations new --description "add users table" --scheme sequential
```

---
## `database migrations pull`

Pull migrations and overwrite local migration files

**Usage**

```bash
netlify database migrations pull
```

**Flags**

- `branch` (*string*) - Pull migrations for a specific branch (defaults to 'production'; pass --branch with no value to use local git branch)
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Skip confirmation prompt
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `json` (*boolean*) - Output result as JSON

**Examples**

```bash
netlify database migrations pull
netlify database migrations pull --branch staging
netlify database migrations pull --branch
netlify database migrations pull --force
```

---
## `database migrations reset`

Delete local migration files that have not been applied yet

**Usage**

```bash
netlify database migrations reset
```

**Flags**

- `branch` (*string*) - Target a remote preview branch instead of the local development database
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output result as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify database migrations reset
netlify database migrations reset --branch my-feature-branch
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
