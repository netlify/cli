---
title: Netlify CLI claim command
sidebar:
  label: claim
---

# `claim`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Claim an anonymously deployed site and link it to your account

**Usage**

```bash
netlify claim
```

**Arguments**

- siteId - The site ID of the anonymous deploy to claim

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `token` (*string*) - The drop token provided when the site was deployed
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify claim abc123 --token drop-jwt-token
```


<!-- AUTO-GENERATED-CONTENT:END -->
