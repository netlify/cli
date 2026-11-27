---
title: Netlify CLI curl command
sidebar:
  label: curl
---

# `curl`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Run curl with access to projects behind Netlify team login protection
Takes the same arguments as curl.

**Usage**

```bash
netlify curl
```

**Arguments**

- args - arguments passed to curl

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify curl https://deploy-preview-42--mysitename.netlify.app/
netlify curl -i -X POST -H "Content-Type: application/json" -d '{"name":"test"}' https://mysitename.netlify.app/api/items
```


<!-- AUTO-GENERATED-CONTENT:END -->
