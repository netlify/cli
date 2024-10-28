---
title: Netlify CLI status command
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

- `verbose` (*boolean*) - Output system info
- `debug` (*boolean*) - Print debugging information
- `force` (*boolean*) - Force command to run. Bypasses prompts for certain destructive commands.

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/commands/status#statushooks) | Print hook information of the linked site  |


---
## `status:hooks`

Print hook information of the linked site

**Usage**

```bash
netlify status:hooks
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `force` (*boolean*) - Force command to run. Bypasses prompts for certain destructive commands.

---

<!-- AUTO-GENERATED-CONTENT:END -->
