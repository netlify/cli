---
title: Netlify CLI teams command
sidebar:
  label: teams
description: Manage Netlify teams via the command line
---

# `teams`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Handle various team operations
The teams command will help you manage your teams

**Usage**

```bash
netlify teams
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`teams:list`](/commands/teams#teamslist) | List all teams you have access to  |


**Examples**

```bash
netlify teams:list
```

---
## `teams:list`

List all teams you have access to

**Usage**

```bash
netlify teams:list
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output team data as JSON
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify teams:list
netlify teams:list --json
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
