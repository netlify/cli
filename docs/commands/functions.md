---
title: Netlify CLI functions command
description: Run netlify dev locally
---

# `functions`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage netlify functions
The `functions` command will help you manage the functions in this site


**Usage**

```bash
netlify functions
```

| Subcommand | description  |
|:--------------------------- |:-----|
| [`functions:build`](/commands/functions#functionsbuild) | build functions locally  |
| [`functions:create`](/commands/functions#functionscreate) | create a new function locally  |


**Examples**

```bash
netlify functions:create --name function-xyz
netlify functions:build --name function-abc --timeout 30s
```

---
## `functions:build`

build functions locally


**Usage**

```bash
netlify functions:build
```

**Flags**

- `functions` (*option*) - Specify a functions folder to build to
- `src` (*option*) - Specify the source folder for the functions

---
## `functions:create`

create a new function locally

**Usage**

```bash
netlify functions:create
```

**Arguments**

- name - name of your new function file inside your functions folder

**Flags**

- `name` (*option*) - function name
- `url` (*option*) - pull template from URL

---

<!-- AUTO-GENERATED-CONTENT:END -->
