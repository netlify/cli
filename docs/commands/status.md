---
title: Netlify CLI status command
sidebar:
  label: status
description: Get the current context of the netlify CLI
---

# `status`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Print status information

**Usage**

```bash
netlify status
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `json` (*boolean*) - Output status information as JSON
- `verbose` (*boolean*) - Output system info

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/commands/status#statushooks) | Print hook information of the linked project  |


---
## `status:hooks`

Print hook information of the linked project

**Usage**

```bash
netlify status:hooks
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

---

<!-- AUTO-GENERATED-CONTENT:END -->
