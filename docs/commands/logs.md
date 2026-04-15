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

- functionNames - Names of the functions to stream logs for

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `level` (*string*) - Log levels to stream. Choices are: trace, debug, info, warn, error, fatal
- `since` (*string*) - Start of the historical log window. Accepts a duration (e.g. 10m, 1h, 24h, 2d) or an ISO 8601 timestamp
- `url` (*string*) - Show logs for the deploy behind the given URL. Supports deploy permalinks and branch subdomains
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `until` (*string*) - End of the historical log window. Accepts a duration or an ISO 8601 timestamp (defaults to now)

**Examples**

```bash
netlify logs:function
netlify logs:function my-function
netlify logs:function my-function other-function
netlify logs:function my-function -l info warn
netlify logs:function my-function --since 1h
netlify logs:function my-function --since 24h
netlify logs:function my-function --since 2026-04-14T00:00:00Z --until 2026-04-15T00:00:00Z
netlify logs:function --url https://my-branch--my-site.netlify.app --since 30m
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
