---
title: Netlify CLI logs command
sidebar:
  label: logs
---

# `logs`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Stream logs from your project

**Usage**

```bash
netlify logs
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`logs:deploy`](/commands/logs#logsdeploy) | Stream the logs of deploys currently being built to the console  |
| [`logs:edge-functions`](/commands/logs#logsedge-functions) | Stream netlify edge function logs to the console  |
| [`logs:function`](/commands/logs#logsfunction) | Stream netlify function logs to the console  |


**Examples**

```bash
netlify logs:deploy
netlify logs:function
netlify logs:function my-function
netlify logs:edge-functions
netlify logs:edge-functions --deploy-id <deploy-id>
```

---
## `logs:deploy`

Stream the logs of deploys currently being built to the console

**Usage**

```bash
netlify logs:deploy
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

---
## `logs:edge-functions`

Stream netlify edge function logs to the console

**Usage**

```bash
netlify logs:edge-functions
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `deploy-id` (*string*) - Deploy ID to stream edge function logs for
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `from` (*string*) - Start date for historical logs (ISO 8601 format)
- `level` (*string*) - Log levels to stream. Choices are: trace, debug, info, warn, error, fatal
- `to` (*string*) - End date for historical logs (ISO 8601 format, defaults to now)

**Examples**

```bash
netlify logs:edge-functions
netlify logs:edge-functions --deploy-id <deploy-id>
netlify logs:edge-functions --from 2026-01-01T00:00:00Z
netlify logs:edge-functions --from 2026-01-01T00:00:00Z --to 2026-01-02T00:00:00Z
netlify logs:edge-functions -l info warn
```

---
## `logs:function`

Stream netlify function logs to the console

**Usage**

```bash
netlify logs:function
```

**Arguments**

- functionName - Name or ID of the function to stream logs for

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `deploy-id` (*string*) - Deploy ID to look up the function from
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `from` (*string*) - Start date for historical logs (ISO 8601 format)
- `level` (*string*) - Log levels to stream. Choices are: trace, debug, info, warn, error, fatal
- `to` (*string*) - End date for historical logs (ISO 8601 format, defaults to now)

**Examples**

```bash
netlify logs:function
netlify logs:function my-function
netlify logs:function my-function --deploy-id <deploy-id>
netlify logs:function my-function -l info warn
netlify logs:function my-function --from 2026-01-01T00:00:00Z
netlify logs:function my-function --from 2026-01-01T00:00:00Z --to 2026-01-02T00:00:00Z
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
