---
title: Netlify CLI dev command
description: Run netlify dev locally
---

# `dev`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->

Local dev server
The dev command will run a local dev server with Netlify's proxy and redirect rules

**Usage**

```bash
netlify dev
```

**Flags**

- `command` (_option_) - command to run
- `port` (_option_) - port of netlify dev
- `targetPort` (_option_) - port of target app server
- `dir` (_option_) - dir with static files
- `functions` (_option_) - Specify a functions folder to serve
- `offline` (_boolean_) - disables any features that require network access
- `live` (_boolean_) - Start a public live session

| Subcommand                                  | description  |
| :------------------------------------------ | :----------- |
| [`dev:exec`](/docs/commands/dev.md#devexec) | Exec command |

**Examples**

```bash
$ netlify dev
$ netlify dev -c "yarn start"
$ netlify dev -c hugo
```

---

## `dev:exec`

Exec command
Runs a command within the netlify dev environment, e.g. with env variables from any installed addons

**Usage**

```bash
netlify dev:exec
```

**Examples**

```bash
$ netlify dev:exec npm run bootstrap
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
