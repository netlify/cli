---
title: Netlify CLI logs command
sidebar:
  label: logs
---

# `logs`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
View logs from your project

**Usage**

```bash
netlify logs
```

**Flags**

- `edge-function` (*string*) - Filter to specific edge functions by name or path
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `follow` (*boolean*) - Stream logs in real time instead of showing historical logs
- `function` (*string*) - Filter to specific functions by name
- `json` (*boolean*) - Output logs as JSON Lines
- `level` (*string*) - Log levels to include. Choices are: trace, debug, info, warn, error, fatal
- `since` (*string*) - Start of the historical log window. Accepts a duration (e.g. 10m, 1h, 24h) or an ISO 8601 timestamp. Defaults to 10m
- `source` (*functions | edge-functions | deploy*) - Log sources to include. Defaults to functions and edge-functions
- `until` (*string*) - End of the historical log window. Accepts a duration or an ISO 8601 timestamp (defaults to now)
- `url` (*string*) - Show logs for the deploy behind the given URL. Supports deploy permalinks and branch subdomains
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify logs
netlify logs --since 1h
netlify logs --source functions --function checkout --since 24h
netlify logs --source edge-functions --since 30m
netlify logs --source deploy --source functions --since 1h
netlify logs --follow
netlify logs --follow --source functions --source edge-functions
netlify logs --json --since 1h
netlify logs --url https://my-branch--my-site.netlify.app --since 1h
```


<!-- AUTO-GENERATED-CONTENT:END -->
