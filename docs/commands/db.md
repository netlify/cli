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

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

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

- `assume-no` (*boolean*) - Non-interactive setup. Does not initialize any third-party tools/boilerplate. Ideal for CI environments or AI tools.
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `boilerplate` (*drizzle*) - Type of boilerplate to add to your project.
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `no-boilerplate` (*boolean*) - Don't add any boilerplate to your project.
- `overwrite` (*boolean*) - Overwrites existing files that would be created when setting up boilerplate

**Examples**

```bash
netlify db init --assume-no
netlify db init --boilerplate=drizzle --overwrite
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
