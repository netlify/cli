---
title: Netlify CLI link command
description: Link an existing site to a local site directory
---

# `link`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Link a local repo or project folder to an existing site on Netlify

**Usage**

```bash
netlify link
```

**Flags**

- `git-remote-name` (*string*) - Name of Git remote to use. e.g. "origin"
- `id` (*string*) - ID of site to link to
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `name` (*string*) - Name of site to link to

**Examples**

```bash
netlify link
netlify link --id 123-123-123-123
netlify link --name my-site-name
```


<!-- AUTO-GENERATED-CONTENT:END -->
