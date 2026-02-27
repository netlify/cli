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

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`logs:deploy`](/commands/logs#logsdeploy) | Stream the logs of deploys currently being built to the console  |
| [`logs:function`](/commands/logs#logsfunction) | Stream netlify function logs to the console  |


**Examples**

```bash
netlify logs:deploy
netlify logs:function
netlify logs:function my-function
```

---
## `logs:deploy`

Stream the logs of deploys currently being built to the console

**Usage**

```bash
netlify logs:deploy
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `logs:function`

Stream netlify function logs to the console

**Usage**

```bash
netlify logs:function
```

**Arguments**

- functionName - Name of the function to stream logs for

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `level` (*string*) - Log levels to stream. Choices are: trace, debug, info, warn, error, fatal
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify logs:function
netlify logs:function my-function
netlify logs:function my-function -l info warn
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
