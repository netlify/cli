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

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site  |


---
## `status:hooks`

Print hook information of the linked site

**Usage**

```bash
netlify status:hooks
```

**Flags**

- `config` (*string*) - Custom path to a netlify configuration file
- `filter` (*string*) - Optional name of an application to run the command in.
This option is needed for working in Monorepos
- `debug` (*boolean*) - Print debugging information

---

<!-- AUTO-GENERATED-CONTENT:END -->
